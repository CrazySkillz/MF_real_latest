/**
 * GA4 Ad Comparison Tab
 * Extracted component for comparing campaign performance metrics.
 * Follows the same pattern as other platform comparison views.
 */
import { Fragment, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Zap, AlertTriangle, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPct } from "@shared/metric-math";
import { formatGA4AdComparisonCardPct, selectGA4AdComparisonLeaderCards } from "@shared/ga4-ad-comparison-cards";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from "recharts";

interface CampaignAgg {
  name: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  revenuePerSession: number;
}

interface GA4AdComparisonProps {
  campaignBreakdownAgg: CampaignAgg[];
  breakdownLoading: boolean;
  breakdownUnavailable?: boolean;
  breakdownStale?: boolean;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  revenueState?: 'loading' | 'ready' | 'stale' | 'unavailable';
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
  formatNumber: (n: number) => string;
  formatMoney: (n: number) => string;
  revenueDisplaySources?: Array<{ sourceId: string; displayName: string; sourceType: string; revenue: number | null; mappingConfig?: any; materializedRevenueStatus?: 'available' | 'unavailable' }>;
}

const METRIC_OPTIONS = [
  { value: "sessions", label: "Sessions" },
  { value: "users", label: "Users" },
  { value: "conversions", label: "Conversions" },
  { value: "revenue", label: "Revenue" },
  { value: "conversionRate", label: "Conversion Rate" },
] as const;

const METRIC_LABELS: Record<string, string> = {
  sessions: "Sessions",
  users: "Users",
  conversions: "Conversions",
  revenue: "Revenue",
  conversionRate: "Conversion Rate",
};

export default function GA4AdComparison({
  campaignBreakdownAgg,
  breakdownLoading,
  breakdownUnavailable = false,
  breakdownStale = false,
  comparisonStartDate = "",
  comparisonEndDate = "",
  revenueState = 'ready',
  selectedMetric,
  onMetricChange,
  formatNumber,
  formatMoney,
  revenueDisplaySources = [],
}: GA4AdComparisonProps) {
  const ga4Revenue = useMemo(() => campaignBreakdownAgg.reduce((s, c) => s + c.revenue, 0), [campaignBreakdownAgg]);
  const ga4RevenueForBreakdown = Number(ga4Revenue.toFixed(2));
  const sourceRevenueBreakdowns = useMemo(() => {
    return new Map(
      revenueDisplaySources.map((source) => {
        const rawCfg = (source as any)?.mappingConfig;
        const cfg = typeof rawCfg === "string"
          ? (() => { try { return JSON.parse(rawCfg); } catch { return null; } })()
          : rawCfg;
        const totals = Array.isArray(cfg?.campaignValueRevenueTotals)
          ? cfg.campaignValueRevenueTotals.filter(
              (item: any) => item?.revenue != null && Number.isFinite(Number(item.revenue)),
            )
          : [];
        return [source.sourceId, totals] as const;
      }),
    );
  }, [revenueDisplaySources]);

  const comparisonRows = useMemo(() => {
    return campaignBreakdownAgg.map((row) => {
      const revenue = Number(row.revenue.toFixed(2));
      return { ...row, revenue, revenuePerSession: row.sessions > 0 ? revenue / row.sessions : 0 };
    });
  }, [campaignBreakdownAgg]);

  const sortedByMetric = useMemo(() => {
    return [...comparisonRows].sort((a, b) => {
      const av = Number((a as any)[selectedMetric] || 0);
      const bv = Number((b as any)[selectedMetric] || 0);
      return bv - av;
    });
  }, [comparisonRows, selectedMetric]);

  const chartRows = useMemo(() => {
    return sortedByMetric;
  }, [sortedByMetric]);

  const chartData = useMemo(() => {
    return chartRows.slice(0, 10).map(c => ({
      name: c.name.length > 30 ? c.name.slice(0, 28) + "..." : c.name,
      fullName: c.name,
      value: Number((c as any)[selectedMetric] || 0),
    }));
  }, [chartRows, selectedMetric]);

  const { bestPerforming, mostEfficient, needsAttention } = useMemo(() => {
    return selectGA4AdComparisonLeaderCards(comparisonRows, selectedMetric);
  }, [comparisonRows, selectedMetric]);

  const fmtMetricValue = (metric: string, value: number) => {
    if (metric === "revenue") return formatMoney(value);
    if (metric === "conversionRate") return `${formatPct(value)}`;
    return formatNumber(value);
  };

  const fmtCardMetricValue = (metric: string, value: number) => {
    if (metric === "conversionRate") return formatGA4AdComparisonCardPct(value);
    return fmtMetricValue(metric, value);
  };

  const totalMetric = useMemo(() => {
    if (selectedMetric === "conversionRate") {
      const totalSessions = sortedByMetric.reduce((s, c) => s + c.sessions, 0);
      const totalConversions = sortedByMetric.reduce((s, c) => s + c.conversions, 0);
      return totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
    }
    return sortedByMetric.reduce((sum, c) => sum + Number((c as any)[selectedMetric] || 0), 0);
  }, [sortedByMetric, selectedMetric]);

  const summaryMetricLabel = selectedMetric === "revenue"
    ? "GA4 Revenue (Imported to Date)"
    : selectedMetric === "conversionRate"
      ? "Overall Conversion Rate"
      : `Total ${METRIC_LABELS[selectedMetric] || selectedMetric}`;

  if (breakdownLoading && campaignBreakdownAgg.length === 0) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (breakdownUnavailable) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-destructive">
            Ad Comparison is unavailable because the campaign breakdown could not be verified. Refresh the page to try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (campaignBreakdownAgg.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground/70">
            No campaign data available. Ensure your GA4 property has UTM campaign tracking configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:items-end">
        <div className="md:col-span-2">
          <h3 className="text-lg font-semibold text-foreground">Ad Comparison</h3>
          <p className="text-sm text-muted-foreground/70">
            {comparisonStartDate && comparisonEndDate
              ? `Compare GA4 campaigns from the initial import (${comparisonStartDate}) through the latest completed day (${comparisonEndDate})`
              : "Compare performance across your GA4 campaigns"}
          </p>
        </div>
        <div className="min-w-[220px] sm:max-w-[280px] md:w-full md:justify-self-end">
          <Select value={selectedMetric} onValueChange={onMetricChange}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Sort by metric" /></SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label} (High to Low)</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {breakdownStale && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">
            Showing the last verified campaign breakdown. The latest refresh failed.
          </CardContent>
        </Card>
      )}

      {/* Performance Rankings */}
      {campaignBreakdownAgg.length >= 2 && (
        <div className="grid gap-4 md:grid-cols-3">
          {bestPerforming && (
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Best Performing</span>
                </div>
                <div className="font-semibold text-foreground truncate" title={bestPerforming.name}>
                  {bestPerforming.name}
                </div>
                <div className="text-sm text-muted-foreground/70 mt-1">
                  {fmtCardMetricValue(selectedMetric, Number((bestPerforming as any)[selectedMetric] || 0))} {METRIC_LABELS[selectedMetric] || selectedMetric} &middot; {formatGA4AdComparisonCardPct(bestPerforming.conversionRate)} CR
                </div>
              </CardContent>
            </Card>
          )}
          {mostEfficient && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Most Efficient</span>
                </div>
                <div className="font-semibold text-foreground truncate" title={mostEfficient.name}>
                  {mostEfficient.name}
                </div>
                <div className="text-sm text-muted-foreground/70 mt-1">
                  {formatGA4AdComparisonCardPct(mostEfficient.conversionRate)} CR &middot; {formatMoney(mostEfficient.revenue)} revenue
                </div>
              </CardContent>
            </Card>
          )}
          {needsAttention && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Needs Attention</span>
                </div>
                <div className="font-semibold text-foreground truncate" title={needsAttention.name}>
                  {needsAttention.name}
                </div>
                <div className="text-sm text-muted-foreground/70 mt-1">
                  {formatGA4AdComparisonCardPct(needsAttention.conversionRate)} CR &middot; {formatNumber(needsAttention.sessions)} sessions
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Campaigns by {METRIC_LABELS[selectedMetric] || selectedMetric}</CardTitle>
          <CardDescription>
            Up to 10 campaigns sorted by {METRIC_LABELS[selectedMetric] || selectedMetric}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => fmtMetricValue(selectedMetric, v)} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={180} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any) => [fmtMetricValue(selectedMetric, Number(value || 0)), METRIC_LABELS[selectedMetric] || selectedMetric]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name={METRIC_LABELS[selectedMetric] || selectedMetric} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground/70">
              {summaryMetricLabel}
              {selectedMetric === "users" && (
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                    <p className="text-xs">User counts are approximate. GA4 users are non-additive - the same user visiting across multiple days, devices, or traffic sources is counted in each breakdown row. Per-campaign and total user counts may be higher than actual unique users.</p>
                  </TooltipContent>
                </UITooltip>
              )}
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {fmtMetricValue(selectedMetric, totalMetric)}
            </div>
            <div className="text-xs text-muted-foreground/70 mt-1">Across all campaigns</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-medium text-muted-foreground/70">Campaigns Compared</div>
            <div className="text-2xl font-bold text-foreground mt-1">{campaignBreakdownAgg.length}</div>
            <div className="text-xs text-muted-foreground/70 mt-1">From GA4 acquisition breakdown</div>
          </CardContent>
        </Card>
      </div>

      {/* Full comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="overflow-hidden border rounded-md">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="sticky top-0 z-10 bg-muted border-b">
                  <tr>
                    <th className="text-left font-medium px-2 py-2 w-[40px]">#</th>
                    <th className="text-left font-medium px-2 py-2">Campaign</th>
                    <th className="text-right font-medium px-2 py-2 w-[90px]">Sessions</th>
                    <th className="text-right font-medium px-2 py-2 w-[80px]">
                      <div className="flex items-center justify-end gap-1">
                        Users
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-amber-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                            <p className="text-xs">Approximate - users are non-additive across breakdown dimensions (dates, devices, sources). Actual unique users may be lower.</p>
                          </TooltipContent>
                        </UITooltip>
                      </div>
                    </th>
                    <th className="text-right font-medium px-2 py-2 w-[100px]">Conversions</th>
                    <th className="text-right font-medium px-2 py-2 w-[90px]">Conv Rate</th>
                    <th className="text-right font-medium px-2 py-2 w-[100px]">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((c, idx) => {
                    return (
                      <tr
                        key={c.name || idx}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-2 py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                        <td className="px-2 py-2 truncate font-medium text-foreground" title={c.name}>{c.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.sessions)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.users)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.conversions)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatPct(c.conversionRate)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatMoney(c.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Breakdown sub-table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
          <CardDescription>
            GA4 revenue uses the initial-import-to-latest-completed-day comparison window. Imported sources are source-to-date provenance and are excluded from campaign ranking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Source</th>
                  <th className="text-right font-medium px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2 text-foreground">GA4 Revenue (imported to date)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(ga4RevenueForBreakdown)}</td>
                </tr>
                {(revenueState === 'ready' || revenueState === 'stale') && revenueDisplaySources.map((s) => (
                  <Fragment key={s.sourceId}>
                    <tr key={s.sourceId} className="border-b">
                      <td className="px-3 py-2 text-foreground">{s.displayName || s.sourceType}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.materializedRevenueStatus === 'unavailable' || s.revenue == null
                          ? <span className="text-destructive text-xs">Unavailable</span>
                          : formatMoney(Number(s.revenue))}
                      </td>
                    </tr>
                    {s.revenue != null && s.materializedRevenueStatus !== 'unavailable' && (sourceRevenueBreakdowns.get(s.sourceId) || []).map((item: any) => (
                      <tr key={`${s.sourceId}-${String(item?.campaignValue || "")}`} className="border-b bg-muted/20">
                        <td className="px-3 py-2 pl-8 text-muted-foreground">{String(item?.campaignValue || "")}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(Number(item?.revenue || 0))}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {revenueState === 'unavailable' && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-destructive text-xs">Imported revenue provenance is unavailable.</td>
                  </tr>
                )}
                {revenueState === 'loading' && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-muted-foreground text-xs">Imported revenue provenance is loading.</td>
                  </tr>
                )}
                {revenueState === 'ready' && revenueDisplaySources.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-muted-foreground text-xs italic">No additional revenue sources</td>
                  </tr>
                )}
                {revenueState === 'stale' && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-amber-700 dark:text-amber-300 text-xs">Imported source amounts are last-good values; the latest refresh failed.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}

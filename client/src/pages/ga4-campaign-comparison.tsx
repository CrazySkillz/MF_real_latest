/**
 * GA4 Campaign Comparison Tab
 * Extracted component for comparing campaign performance metrics.
 * Follows the same pattern as Google Ads Campaign Comparison and LinkedIn Ad Comparison.
 */
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Zap, AlertTriangle, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPct } from "@shared/metric-math";
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

interface GA4CampaignComparisonProps {
  campaignBreakdownAgg: CampaignAgg[];
  breakdownLoading: boolean;
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
  formatNumber: (n: number) => string;
  formatMoney: (n: number) => string;
  totalRevenue?: number;
  revenueDisplaySources?: Array<{ sourceId: string; displayName: string; sourceType: string; revenue: number | null; mappingConfig?: any }>;
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

export default function GA4CampaignComparison({
  campaignBreakdownAgg,
  breakdownLoading,
  selectedMetric,
  onMetricChange,
  formatNumber,
  formatMoney,
  totalRevenue = 0,
  revenueDisplaySources = [],
}: GA4CampaignComparisonProps) {
  const normalizeCampaignKey = (value: string) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

  const ga4Revenue = useMemo(() => campaignBreakdownAgg.reduce((s, c) => s + c.revenue, 0), [campaignBreakdownAgg]);
  const importedRevenue = totalRevenue - ga4Revenue;
  const hasImportedRevenue = importedRevenue > 0;
  const allocationSummary = useMemo(() => {
    const rowCounts = new Map<string, number>();
    const rowNameByKey = new Map<string, string>();
    for (const row of campaignBreakdownAgg) {
      const key = normalizeCampaignKey(row.name);
      if (!key) continue;
      rowCounts.set(key, (rowCounts.get(key) || 0) + 1);
      if (!rowNameByKey.has(key)) rowNameByKey.set(key, row.name);
    }

    const matchedByRow = new Map<string, number>();
    let matchedExternalRevenue = 0;
    for (const source of revenueDisplaySources) {
      const cfg = (source as any)?.mappingConfig;
      const totals = Array.isArray(cfg?.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
      for (const item of totals) {
        const campaignValue = String(item?.campaignValue || "").trim();
        const revenue = Number(item?.revenue || 0);
        const key = normalizeCampaignKey(campaignValue);
        if (!key || !(revenue > 0) || rowCounts.get(key) !== 1) continue;
        const rowName = rowNameByKey.get(key);
        if (!rowName) continue;
        matchedByRow.set(rowName, (matchedByRow.get(rowName) || 0) + revenue);
        matchedExternalRevenue += revenue;
      }
    }

    return {
      matchedByRow,
      matchedExternalRevenue: Number(matchedExternalRevenue.toFixed(2)),
      unallocatedExternalRevenue: Math.max(0, Number((importedRevenue - matchedExternalRevenue).toFixed(2))),
    };
  }, [campaignBreakdownAgg, importedRevenue, revenueDisplaySources]);

  const comparisonRows = useMemo(() => {
    if (selectedMetric !== "revenue") return campaignBreakdownAgg;
    return campaignBreakdownAgg.map((row) => {
      const matchedExternal = allocationSummary.matchedByRow.get(row.name) || 0;
      const revenue = Number((row.revenue + matchedExternal).toFixed(2));
      return { ...row, revenue, revenuePerSession: row.sessions > 0 ? revenue / row.sessions : 0 };
    });
  }, [allocationSummary.matchedByRow, campaignBreakdownAgg, selectedMetric]);

  const revenueModeWithImportedSources = selectedMetric === "revenue" && (hasImportedRevenue || allocationSummary.matchedExternalRevenue > 0);

  const RevenueBanner = () => hasImportedRevenue ? (
    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 flex items-start gap-2">
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <span className="font-medium">Total Revenue: {formatMoney(totalRevenue)}</span>
        <span className="text-xs ml-1">(GA4: {formatMoney(ga4Revenue)} + other sources: {formatMoney(importedRevenue)})</span>
        <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-300">Exact external revenue matches are added into campaign rows when source campaign values match GA4 campaign rows. Remaining external revenue stays unallocated.</p>
      </div>
    </div>
  ) : null;

  const sortedByMetric = useMemo(() => {
    return [...comparisonRows].sort((a, b) => {
      const av = Number((a as any)[selectedMetric] || 0);
      const bv = Number((b as any)[selectedMetric] || 0);
      return bv - av;
    });
  }, [comparisonRows, selectedMetric]);

  const chartData = useMemo(() => {
    return sortedByMetric.slice(0, 10).map(c => ({
      name: c.name.length > 30 ? c.name.slice(0, 28) + "..." : c.name,
      fullName: c.name,
      value: Number((c as any)[selectedMetric] || 0),
    }));
  }, [sortedByMetric, selectedMetric]);

  const bestPerforming = useMemo(() => {
    return [...comparisonRows].sort((a, b) => {
      const av = Number((a as any)[selectedMetric] || 0);
      const bv = Number((b as any)[selectedMetric] || 0);
      return bv - av;
    })[0];
  }, [comparisonRows, selectedMetric]);

  const mostEfficient = useMemo(() => {
    return [...campaignBreakdownAgg].filter(c => c.sessions > 0).sort((a, b) => b.conversionRate - a.conversionRate)[0];
  }, [campaignBreakdownAgg]);

  const needsAttention = useMemo(() => {
    const sorted = [...campaignBreakdownAgg].filter(c => c.sessions > 0).sort((a, b) => a.conversionRate - b.conversionRate);
    // Avoid showing the same campaign as both Best Performing and Needs Attention
    const candidate = sorted[0];
    if (candidate && candidate.name === bestPerforming?.name && sorted.length > 1) return sorted[1];
    return candidate;
  }, [campaignBreakdownAgg, bestPerforming]);

  const fmtMetricValue = (metric: string, value: number) => {
    if (metric === "revenue") return formatMoney(value);
    if (metric === "conversionRate") return `${formatPct(value)}`;
    return formatNumber(value);
  };

  const totalMetric = useMemo(() => {
    if (selectedMetric === "conversionRate") {
      const totalSessions = sortedByMetric.reduce((s, c) => s + c.sessions, 0);
      const totalConversions = sortedByMetric.reduce((s, c) => s + c.conversions, 0);
      return totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
    }
    // For revenue, use the full financial total (GA4 + imported sources) instead of
    // just the breakdown sum, which only covers GA4 campaign-attributed revenue.
    if (selectedMetric === "revenue" && totalRevenue > 0) {
      return totalRevenue;
    }
    return sortedByMetric.reduce((sum, c) => sum + Number((c as any)[selectedMetric] || 0), 0);
  }, [sortedByMetric, selectedMetric, totalRevenue]);

  if (breakdownLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
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
      {/* Header with metric selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Ad Comparison</h3>
          <p className="text-sm text-muted-foreground/70">Compare performance across your GA4 campaigns</p>
        </div>
        <div className="min-w-[220px]">
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
                  {fmtMetricValue(selectedMetric, Number((bestPerforming as any)[selectedMetric] || 0))} {METRIC_LABELS[selectedMetric] || selectedMetric}{revenueModeWithImportedSources ? " (matched external included)" : ""} &middot; {formatPct(bestPerforming.conversionRate)} CR
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
                  {formatPct(mostEfficient.conversionRate)} CR &middot; {formatMoney(mostEfficient.revenue)} revenue
                </div>
              </CardContent>
            </Card>
          )}
          {needsAttention && needsAttention.name !== mostEfficient?.name && (
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
                  {formatPct(needsAttention.conversionRate)} CR &middot; {formatNumber(needsAttention.sessions)} sessions
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Revenue banner — shown prominently when imported revenue exists */}
      {selectedMetric === "revenue" && <RevenueBanner />}

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Campaigns by {METRIC_LABELS[selectedMetric] || selectedMetric}</CardTitle>
          <CardDescription>
            Up to 10 campaigns sorted by {METRIC_LABELS[selectedMetric] || selectedMetric}
            {revenueModeWithImportedSources ? " (exact matched external revenue is included in rows; unmatched external revenue stays separate)." : ""}
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
              {selectedMetric === "revenue" ? "Total Revenue (All Sources)" : `Total ${METRIC_LABELS[selectedMetric] || selectedMetric}`}
              {selectedMetric === "users" && (
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                    <p className="text-xs">User counts are approximate. GA4 users are non-additive — the same user visiting across multiple days, devices, or traffic sources is counted in each breakdown row. Per-campaign and total user counts may be higher than actual unique users.</p>
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
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
          <CardDescription>
            Full comparison sorted by {METRIC_LABELS[selectedMetric] || selectedMetric}
            {revenueModeWithImportedSources ? " • first row shows all-source total; only exact matched external revenue is added to campaign rows" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
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
                            <p className="text-xs">Approximate — users are non-additive across breakdown dimensions (dates, devices, sources). Actual unique users may be lower.</p>
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
                  {revenueModeWithImportedSources && (
                    <tr className="border-b bg-muted/30 font-bold">
                      <td className="px-2 py-2 text-muted-foreground tabular-nums">—</td>
                      <td className="px-2 py-2 font-medium text-foreground">Total Revenue (All Sources)</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(totalRevenue)}</td>
                    </tr>
                  )}
                  {revenueModeWithImportedSources && allocationSummary.unallocatedExternalRevenue > 0 && (
                    <tr className="border-b bg-amber-50/60 dark:bg-amber-900/10">
                      <td className="px-2 py-2 text-muted-foreground tabular-nums">—</td>
                      <td className="px-2 py-2 font-medium text-foreground">Unallocated External Revenue</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">—</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(allocationSummary.unallocatedExternalRevenue)}</td>
                    </tr>
                  )}
                  {sortedByMetric.map((c, idx) => {
                    const isTop = idx === 0;
                    const isBottom = idx === sortedByMetric.length - 1 && sortedByMetric.length > 1;
                    return (
                      <tr
                        key={c.name || idx}
                        className={`border-b last:border-b-0 ${isTop ? "bg-emerald-50 dark:bg-emerald-900/10" : isBottom ? "bg-red-50 dark:bg-red-900/10" : ""}`}
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
          <CardTitle className="text-base">Revenue Breakdown</CardTitle>
          <CardDescription>Total revenue across all sources</CardDescription>
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
                <tr className="border-b font-bold bg-muted/30">
                  <td className="px-3 py-2.5 text-foreground">Total Revenue</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{formatMoney(totalRevenue > 0 ? totalRevenue : ga4Revenue)}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 text-foreground">GA4 Revenue</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(ga4Revenue)}</td>
                </tr>
                {revenueDisplaySources.filter(s => s.revenue != null && Number(s.revenue) > 0).map((s) => (
                  <tr key={s.sourceId} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-muted-foreground">{s.displayName || s.sourceType}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Number(s.revenue))}</td>
                  </tr>
                ))}
                {allocationSummary.unallocatedExternalRevenue > 0 && (
                  <tr className="border-b last:border-b-0 bg-amber-50/60 dark:bg-amber-900/10">
                    <td className="px-3 py-2 text-foreground">Unallocated External Revenue (included above)</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(allocationSummary.unallocatedExternalRevenue)}</td>
                  </tr>
                )}
                {revenueDisplaySources.filter(s => s.revenue != null && Number(s.revenue) > 0).length === 0 && !hasImportedRevenue && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-muted-foreground text-xs italic">No additional revenue sources</td>
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

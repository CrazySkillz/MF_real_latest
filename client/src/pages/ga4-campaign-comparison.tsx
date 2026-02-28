/**
 * GA4 Campaign Comparison Tab
 * Extracted component for comparing campaign performance metrics.
 * Follows the same pattern as Google Ads Campaign Comparison and LinkedIn Ad Comparison.
 */
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Zap, AlertTriangle } from "lucide-react";
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
}: GA4CampaignComparisonProps) {

  const sortedByMetric = useMemo(() => {
    return [...campaignBreakdownAgg].sort((a, b) => {
      const av = Number((a as any)[selectedMetric] || 0);
      const bv = Number((b as any)[selectedMetric] || 0);
      return bv - av;
    });
  }, [campaignBreakdownAgg, selectedMetric]);

  const chartData = useMemo(() => {
    return sortedByMetric.slice(0, 10).map(c => ({
      name: c.name.length > 30 ? c.name.slice(0, 28) + "..." : c.name,
      fullName: c.name,
      value: Number((c as any)[selectedMetric] || 0),
    }));
  }, [sortedByMetric, selectedMetric]);

  const bestPerforming = useMemo(() => {
    return [...campaignBreakdownAgg].sort((a, b) => b.conversions - a.conversions)[0];
  }, [campaignBreakdownAgg]);

  const mostEfficient = useMemo(() => {
    return [...campaignBreakdownAgg].filter(c => c.sessions > 0).sort((a, b) => b.conversionRate - a.conversionRate)[0];
  }, [campaignBreakdownAgg]);

  const needsAttention = useMemo(() => {
    return [...campaignBreakdownAgg].filter(c => c.sessions > 0).sort((a, b) => a.conversionRate - b.conversionRate)[0];
  }, [campaignBreakdownAgg]);

  const fmtMetricValue = (metric: string, value: number) => {
    if (metric === "revenue") return formatMoney(value);
    if (metric === "conversionRate") return `${value.toFixed(2)}%`;
    return formatNumber(value);
  };

  const totalMetric = useMemo(() => {
    if (selectedMetric === "conversionRate") {
      const totalSessions = sortedByMetric.reduce((s, c) => s + c.sessions, 0);
      const totalConversions = sortedByMetric.reduce((s, c) => s + c.conversions, 0);
      return totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
    }
    return sortedByMetric.reduce((sum, c) => sum + Number((c as any)[selectedMetric] || 0), 0);
  }, [sortedByMetric, selectedMetric]);

  if (breakdownLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (campaignBreakdownAgg.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            No campaign data available. Ensure your GA4 property has UTM campaign tracking configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with metric selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ad Comparison</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Compare performance across your GA4 campaigns</p>
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
                <div className="font-semibold text-slate-900 dark:text-white truncate" title={bestPerforming.name}>
                  {bestPerforming.name}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {formatNumber(bestPerforming.conversions)} conversions &middot; {bestPerforming.conversionRate.toFixed(2)}% CR
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
                <div className="font-semibold text-slate-900 dark:text-white truncate" title={mostEfficient.name}>
                  {mostEfficient.name}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {mostEfficient.conversionRate.toFixed(2)}% CR &middot; {formatMoney(mostEfficient.revenue)} revenue
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
                <div className="font-semibold text-slate-900 dark:text-white truncate" title={needsAttention.name}>
                  {needsAttention.name}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {needsAttention.conversionRate.toFixed(2)}% CR &middot; {formatNumber(needsAttention.sessions)} sessions
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Campaigns by {METRIC_LABELS[selectedMetric] || selectedMetric}</CardTitle>
          <CardDescription>Up to 10 campaigns sorted by {METRIC_LABELS[selectedMetric] || selectedMetric}</CardDescription>
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
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Total {METRIC_LABELS[selectedMetric] || selectedMetric}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {fmtMetricValue(selectedMetric, totalMetric)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all campaigns</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Campaigns Compared</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{campaignBreakdownAgg.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">From GA4 acquisition breakdown</div>
          </CardContent>
        </Card>
      </div>

      {/* Full comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
          <CardDescription>Full comparison sorted by {METRIC_LABELS[selectedMetric] || selectedMetric}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="overflow-hidden border rounded-md">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b">
                  <tr>
                    <th className="text-left font-medium px-2 py-2 w-[40px]">#</th>
                    <th className="text-left font-medium px-2 py-2">Campaign</th>
                    <th className="text-right font-medium px-2 py-2 w-[90px]">Sessions</th>
                    <th className="text-right font-medium px-2 py-2 w-[80px]">Users</th>
                    <th className="text-right font-medium px-2 py-2 w-[100px]">Conversions</th>
                    <th className="text-right font-medium px-2 py-2 w-[90px]">Conv Rate</th>
                    <th className="text-right font-medium px-2 py-2 w-[100px]">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedByMetric.map((c, idx) => {
                    const isTop = idx === 0;
                    const isBottom = idx === sortedByMetric.length - 1 && sortedByMetric.length > 1;
                    return (
                      <tr
                        key={c.name || idx}
                        className={`border-b last:border-b-0 ${isTop ? "bg-emerald-50 dark:bg-emerald-900/10" : isBottom ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                      >
                        <td className="px-2 py-2 text-slate-500 tabular-nums">{idx + 1}</td>
                        <td className="px-2 py-2 truncate font-medium text-slate-900 dark:text-white" title={c.name}>{c.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.sessions)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.users)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.conversions)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.conversionRate.toFixed(2)}%</td>
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
    </div>
  );
}

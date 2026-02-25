import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useState, useMemo } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Video, Search } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const fmt = (v: number) => v.toLocaleString();
const fmtCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

const METRIC_OPTIONS = [
  { key: "spend", label: "Spend", format: fmtCurrency, color: "#8b5cf6" },
  { key: "impressions", label: "Impressions", format: fmt, color: "#3b82f6" },
  { key: "clicks", label: "Clicks", format: fmt, color: "#10b981" },
  { key: "conversions", label: "Conversions", format: fmt, color: "#f59e0b" },
  { key: "ctr", label: "CTR (%)", format: fmtPct, color: "#ef4444" },
  { key: "cpc", label: "CPC", format: fmtCurrency, color: "#ec4899" },
  { key: "cpm", label: "CPM", format: fmtCurrency, color: "#6366f1" },
  { key: "videoViews", label: "Video Views", format: fmt, color: "#14b8a6" },
  { key: "conversionRate", label: "Conversion Rate (%)", format: fmtPct, color: "#f97316" },
  { key: "searchImpressionShare", label: "Search Impression Share (%)", format: fmtPct, color: "#a855f7" },
];

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  spend: string;
  conversions: string;
  conversionValue: string;
  ctr: string;
  cpc: string;
  cpm: string;
  videoViews: number;
  searchImpressionShare: string;
  costPerConversion: string | null;
  conversionRate: string | null;
  googleCampaignName: string;
}

export default function GoogleAdsAnalytics() {
  const [, params] = useRoute("/campaigns/:id/google-ads-analytics");
  const campaignId = params?.id;
  const [trendMetric, setTrendMetric] = useState("spend");
  const [dateRange, setDateRange] = useState("30");

  // Fetch connection
  const { data: connection } = useQuery({
    queryKey: ["/api/google-ads", campaignId, "connection"],
    queryFn: async () => {
      const res = await fetch(`/api/google-ads/${campaignId}/connection`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Fetch daily metrics
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ["/api/google-ads", campaignId, "daily-metrics", dateRange],
    queryFn: async () => {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString().slice(0, 10);
      const res = await fetch(`/api/google-ads/${campaignId}/daily-metrics?startDate=${start}&endDate=${end}`);
      if (!res.ok) return { metrics: [] };
      return res.json();
    },
    enabled: !!campaignId,
  });

  const metrics: DailyMetric[] = metricsData?.metrics || [];

  // Aggregate summary
  const summary = useMemo(() => {
    if (!metrics.length) return null;
    const totals = metrics.reduce(
      (acc, m) => ({
        impressions: acc.impressions + (m.impressions || 0),
        clicks: acc.clicks + (m.clicks || 0),
        spend: acc.spend + parseFloat(m.spend || "0"),
        conversions: acc.conversions + parseFloat(m.conversions || "0"),
        conversionValue: acc.conversionValue + parseFloat(m.conversionValue || "0"),
        videoViews: acc.videoViews + (m.videoViews || 0),
      }),
      { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, videoViews: 0 }
    );
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    const convRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
    const costPerConv = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    return { ...totals, ctr, cpc, cpm, convRate, costPerConv };
  }, [metrics]);

  // Chart data (aggregated by date)
  const chartData = useMemo(() => {
    const byDate = new Map<string, any>();
    for (const m of metrics) {
      const existing = byDate.get(m.date) || {
        date: m.date, impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0,
        ctr: 0, cpc: 0, cpm: 0, conversionRate: 0, searchImpressionShare: 0, _count: 0,
      };
      existing.impressions += m.impressions || 0;
      existing.clicks += m.clicks || 0;
      existing.spend += parseFloat(m.spend || "0");
      existing.conversions += parseFloat(m.conversions || "0");
      existing.videoViews += m.videoViews || 0;
      existing.ctr += parseFloat(m.ctr || "0");
      existing.searchImpressionShare += parseFloat(m.searchImpressionShare || "0");
      existing._count += 1;
      byDate.set(m.date, existing);
    }
    return Array.from(byDate.values())
      .map((d) => ({
        ...d,
        ctr: d._count > 0 ? d.ctr / d._count : 0,
        cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
        cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
        conversionRate: d.clicks > 0 ? (d.conversions / d.clicks) * 100 : 0,
        searchImpressionShare: d._count > 0 ? d.searchImpressionShare / d._count : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const selectedMetricDef = METRIC_OPTIONS.find((m) => m.key === trendMetric) || METRIC_OPTIONS[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <i className="fab fa-google text-yellow-600 text-xl" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Google Ads Analytics</h1>
            </div>
            {connection?.connected && (
              <Badge className="bg-green-600 text-white ml-2">
                {connection.customerName || connection.customerId}
                {connection.method === "test_mode" && " (Test)"}
              </Badge>
            )}
            <div className="ml-auto">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">Loading metrics...</div>
          ) : !summary ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <p className="text-lg font-medium">No data yet</p>
                <p className="text-sm mt-1">
                  Click "Refresh Data" on the Google Ads connection card to generate initial metrics.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <SummaryCard icon={<Eye className="w-4 h-4" />} label="Impressions" value={fmt(summary.impressions)} />
                <SummaryCard icon={<MousePointer className="w-4 h-4" />} label="Clicks" value={fmt(summary.clicks)} />
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="Spend" value={fmtCurrency(summary.spend)} />
                <SummaryCard icon={<Target className="w-4 h-4" />} label="Conversions" value={fmt(Math.round(summary.conversions))} />
                <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="CTR" value={fmtPct(summary.ctr)} />
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="CPC" value={fmtCurrency(summary.cpc)} />
              </div>

              {/* Secondary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="CPM" value={fmtCurrency(summary.cpm)} />
                <SummaryCard icon={<Video className="w-4 h-4" />} label="Video Views" value={fmt(summary.videoViews)} />
                <SummaryCard icon={<Target className="w-4 h-4" />} label="Conv. Rate" value={fmtPct(summary.convRate)} />
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="Cost/Conv" value={fmtCurrency(summary.costPerConv)} />
              </div>

              {/* Trend Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Daily Trend</CardTitle>
                    <Select value={trendMetric} onValueChange={setTrendMetric}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METRIC_OPTIONS.map((m) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickFormatter={(v) => selectedMetricDef.format(v)}
                          tick={{ fontSize: 11 }}
                          width={80}
                        />
                        <Tooltip
                          formatter={(v: number) => [selectedMetricDef.format(v), selectedMetricDef.label]}
                          labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString()}
                        />
                        <Line
                          type="monotone"
                          dataKey={trendMetric}
                          stroke={selectedMetricDef.color}
                          strokeWidth={2}
                          dot={chartData.length <= 31}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="py-12 text-center text-slate-400">No chart data available</div>
                  )}
                </CardContent>
              </Card>

              {/* Daily Metrics Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Daily Metrics</CardTitle>
                  <CardDescription>{chartData.length} days of data</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                        <TableHead className="text-right">Conv. Rate</TableHead>
                        <TableHead className="text-right">Cost/Conv</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...chartData].reverse().map((row) => (
                        <TableRow key={row.date}>
                          <TableCell className="font-medium">
                            {new Date(row.date + "T00:00:00").toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">{fmt(row.impressions)}</TableCell>
                          <TableCell className="text-right">{fmt(row.clicks)}</TableCell>
                          <TableCell className="text-right">{fmtPct(row.ctr)}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(row.spend)}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(row.cpc)}</TableCell>
                          <TableCell className="text-right">{fmt(Math.round(row.conversions))}</TableCell>
                          <TableCell className="text-right">{fmtPct(row.conversionRate)}</TableCell>
                          <TableCell className="text-right">
                            {row.conversions > 0 ? fmtCurrency(row.spend / row.conversions) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 text-slate-500 mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

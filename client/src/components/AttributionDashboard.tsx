import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, MousePointer, Target, TrendingUp, Eye, Users, Activity } from "lucide-react";

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

interface ChannelData {
  name: string;
  spend: number;
  conversions: number;
  clicks: number;
  impressions: number;
  revenue: number;
  leads: number;
  connected: boolean;
}

export function AttributionDashboard({ campaignId }: { campaignId: string }) {
  const { data: outcomeTotals, isLoading } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "30days"],
    enabled: !!campaignId,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/outcome-totals?dateRange=30days`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const channels = useMemo((): ChannelData[] => {
    if (!outcomeTotals) return [];
    const platforms = outcomeTotals.platforms || {};
    const ga4 = outcomeTotals.ga4 || {};
    const result: ChannelData[] = [];

    const num = (v: any) => Number(v || 0);

    if (platforms.linkedin?.connected || num(platforms.linkedin?.spend) > 0) {
      const p = platforms.linkedin || {};
      result.push({
        name: 'LinkedIn',
        spend: num(p.spend),
        conversions: num(p.conversions),
        clicks: num(p.clicks),
        impressions: num(p.impressions),
        revenue: num(p.attributedRevenue),
        leads: num(p.leads),
        connected: true,
      });
    }

    if (platforms.meta?.connected || num(platforms.meta?.spend) > 0) {
      const p = platforms.meta || {};
      result.push({
        name: 'Meta',
        spend: num(p.spend),
        conversions: num(p.conversions),
        clicks: num(p.clicks),
        impressions: num(p.impressions),
        revenue: num(p.attributedRevenue),
        leads: 0,
        connected: true,
      });
    }

    if (ga4.connected || num(ga4.revenue) > 0 || num(ga4.conversions) > 0) {
      result.push({
        name: 'GA4',
        spend: 0,
        conversions: num(ga4.conversions),
        clicks: 0,
        impressions: 0,
        revenue: num(ga4.revenue),
        leads: 0,
        connected: true,
      });
    }

    if (platforms.customIntegration?.connected || num(platforms.customIntegration?.spend) > 0) {
      const p = platforms.customIntegration || {};
      result.push({
        name: 'Custom Integration',
        spend: num(p.spend),
        conversions: num(p.conversions),
        clicks: num(p.clicks),
        impressions: num(p.impressions),
        revenue: num(p.revenue),
        leads: 0,
        connected: true,
      });
    }

    // Revenue sources (Shopify, HubSpot, Salesforce)
    const revenueSources = outcomeTotals.revenueSources || [];
    for (const src of revenueSources) {
      if (src?.connected && num(src?.lastTotalRevenue) > 0) {
        const label = String(src.type || 'Revenue Source').charAt(0).toUpperCase() + String(src.type || '').slice(1);
        result.push({
          name: label,
          spend: 0,
          conversions: 0,
          clicks: 0,
          impressions: 0,
          revenue: num(src.lastTotalRevenue),
          leads: 0,
          connected: true,
        });
      }
    }

    return result;
  }, [outcomeTotals]);

  // Totals
  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalConversions = channels.reduce((s, c) => s + c.conversions, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
  const totalClicks = channels.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = channels.reduce((s, c) => s + c.impressions, 0);
  const hasRevenue = totalRevenue > 0;
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const overallCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtN = (n: number) => n.toLocaleString();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-slate-500">Loading channel attribution data...</p>
        </CardContent>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center">
            <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Channel Data Available</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Connect platforms (LinkedIn, Meta, GA4) to see channel attribution data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Chart data
  const spendChannels = channels.filter(c => c.spend > 0);
  const barData = channels.filter(c => c.spend > 0 || c.conversions > 0).map(c => ({
    name: c.name,
    Spend: Number(c.spend.toFixed(2)),
    Conversions: c.conversions,
  }));
  const pieData = spendChannels.map(c => ({
    name: c.name,
    value: Number(c.spend.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Channel Attribution</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Performance breakdown across connected platforms (last 30 days)
        </p>
      </div>

      {/* Section 1: Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Spend</p>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(totalSpend)}</p>
            <p className="text-xs text-slate-500 mt-1">{spendChannels.length} channel{spendChannels.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">Impressions</p>
              <Eye className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmtN(totalImpressions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">Clicks</p>
              <MousePointer className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmtN(totalClicks)}</p>
            <p className="text-xs text-slate-500 mt-1">{totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'}% CTR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">Conversions</p>
              <Target className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmtN(totalConversions)}</p>
            <p className="text-xs text-slate-500 mt-1">{overallCpa > 0 ? fmt(overallCpa) : '—'} CPA</p>
          </CardContent>
        </Card>
        {hasRevenue && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">Revenue</p>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-green-600">{fmt(totalRevenue)}</p>
            </CardContent>
          </Card>
        )}
        {hasRevenue && totalSpend > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">ROAS</p>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{overallRoas.toFixed(2)}x</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 2: Channel Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((ch, i) => {
          const cpa = ch.conversions > 0 ? ch.spend / ch.conversions : 0;
          const roas = ch.spend > 0 && ch.revenue > 0 ? ch.revenue / ch.spend : 0;
          const ctr = ch.impressions > 0 ? (ch.clicks / ch.impressions) * 100 : 0;
          const spendShare = totalSpend > 0 ? (ch.spend / totalSpend) * 100 : 0;
          return (
            <Card key={ch.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ch.name}</CardTitle>
                  {ch.spend > 0 && totalSpend > 0 && (
                    <Badge variant="outline" className="text-xs">{spendShare.toFixed(0)}% of spend</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {ch.spend > 0 && (
                    <div>
                      <p className="text-slate-500">Spend</p>
                      <p className="font-semibold">{fmt(ch.spend)}</p>
                    </div>
                  )}
                  {ch.conversions > 0 && (
                    <div>
                      <p className="text-slate-500">Conversions</p>
                      <p className="font-semibold">{fmtN(ch.conversions)}</p>
                    </div>
                  )}
                  {ch.clicks > 0 && (
                    <div>
                      <p className="text-slate-500">Clicks</p>
                      <p className="font-semibold">{fmtN(ch.clicks)}</p>
                    </div>
                  )}
                  {ctr > 0 && (
                    <div>
                      <p className="text-slate-500">CTR</p>
                      <p className="font-semibold">{ctr.toFixed(2)}%</p>
                    </div>
                  )}
                  {cpa > 0 && (
                    <div>
                      <p className="text-slate-500">CPA</p>
                      <p className="font-semibold">{fmt(cpa)}</p>
                    </div>
                  )}
                  {ch.revenue > 0 && (
                    <div>
                      <p className="text-slate-500">Revenue</p>
                      <p className="font-semibold text-green-600">{fmt(ch.revenue)}</p>
                    </div>
                  )}
                  {roas > 0 && (
                    <div>
                      <p className="text-slate-500">ROAS</p>
                      <p className="font-semibold">{roas.toFixed(2)}x</p>
                    </div>
                  )}
                  {ch.leads > 0 && (
                    <div>
                      <p className="text-slate-500">Leads</p>
                      <p className="font-semibold">{fmtN(ch.leads)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Section 3: Charts */}
      {(barData.length > 0 || pieData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart: Spend vs Conversions */}
          {barData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Channel Performance</CardTitle>
                <CardDescription>Spend and conversions by platform</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Spend" fill="#3b82f6" name="Spend ($)" />
                    <Bar dataKey="Conversions" fill="#10b981" name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Pie Chart: Budget Allocation */}
          {pieData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Budget Allocation</CardTitle>
                <CardDescription>Spend distribution across platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={false}
                      label={({ name, value }: any) => `${name}: $${value.toFixed(0)}`}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Section 4: Channel Metrics Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Channel Metrics</CardTitle>
          <CardDescription>Detailed performance comparison across all platforms</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Channel</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Spend</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Impressions</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Clicks</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">CTR</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Conversions</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">CPA</th>
                  {hasRevenue && <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Revenue</th>}
                  {hasRevenue && totalSpend > 0 && <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">ROAS</th>}
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => {
                  const cpa = ch.conversions > 0 ? ch.spend / ch.conversions : 0;
                  const roas = ch.spend > 0 && ch.revenue > 0 ? ch.revenue / ch.spend : 0;
                  const ctr = ch.impressions > 0 ? (ch.clicks / ch.impressions) * 100 : 0;
                  return (
                    <tr key={ch.name} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{ch.name}</td>
                      <td className="text-right py-3 px-4">{ch.spend > 0 ? fmt(ch.spend) : '—'}</td>
                      <td className="text-right py-3 px-4">{ch.impressions > 0 ? fmtN(ch.impressions) : '—'}</td>
                      <td className="text-right py-3 px-4">{ch.clicks > 0 ? fmtN(ch.clicks) : '—'}</td>
                      <td className="text-right py-3 px-4">{ctr > 0 ? `${ctr.toFixed(2)}%` : '—'}</td>
                      <td className="text-right py-3 px-4">{ch.conversions > 0 ? fmtN(ch.conversions) : '—'}</td>
                      <td className="text-right py-3 px-4">{cpa > 0 ? fmt(cpa) : '—'}</td>
                      {hasRevenue && <td className="text-right py-3 px-4">{ch.revenue > 0 ? fmt(ch.revenue) : '—'}</td>}
                      {hasRevenue && totalSpend > 0 && <td className="text-right py-3 px-4">{roas > 0 ? `${roas.toFixed(2)}x` : '—'}</td>}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                  <td className="py-3 px-4 text-slate-900 dark:text-white">Total</td>
                  <td className="text-right py-3 px-4">{totalSpend > 0 ? fmt(totalSpend) : '—'}</td>
                  <td className="text-right py-3 px-4">{totalImpressions > 0 ? fmtN(totalImpressions) : '—'}</td>
                  <td className="text-right py-3 px-4">{totalClicks > 0 ? fmtN(totalClicks) : '—'}</td>
                  <td className="text-right py-3 px-4">{totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%` : '—'}</td>
                  <td className="text-right py-3 px-4">{totalConversions > 0 ? fmtN(totalConversions) : '—'}</td>
                  <td className="text-right py-3 px-4">{overallCpa > 0 ? fmt(overallCpa) : '—'}</td>
                  {hasRevenue && <td className="text-right py-3 px-4">{totalRevenue > 0 ? fmt(totalRevenue) : '—'}</td>}
                  {hasRevenue && totalSpend > 0 && <td className="text-right py-3 px-4">{overallRoas > 0 ? `${overallRoas.toFixed(2)}x` : '—'}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

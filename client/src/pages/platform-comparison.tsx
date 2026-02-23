import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, TrendingUp, Target, Users, DollarSign, Eye, AlertCircle, Zap, Brain, Activity, Info, FlaskConical } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function PlatformComparison() {
  const { id: campaignId } = useParams();
  const [demoMode, setDemoMode] = useState(false);

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: ga4Data } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
  });

  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
  });

  // Get LinkedIn metrics
  const { data: linkedInData } = useQuery({
    queryKey: ["/api/linkedin/metrics", campaignId],
    enabled: !!campaignId,
  });

  // Get Custom Integration data
  const { data: customIntegrationData } = useQuery({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
  });

  // Get Meta analytics (fallback when outcome-totals unavailable)
  const { data: metaAnalytics } = useQuery<any>({
    queryKey: ["/api/meta", campaignId, "analytics"],
    queryFn: async () => {
      const resp = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
    enabled: !!campaignId,
  });

  // Unified outcome-totals for Meta, GA4, revenue sources, and real revenue data
  const { data: outcomeTotals } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "outcome-totals", "30days", demoMode ? "demo" : "live"],
    enabled: !!campaignId,
    queryFn: async () => {
      const url = `/api/campaigns/${campaignId}/outcome-totals?dateRange=30days${demoMode ? "&demo=1" : ""}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  // Revenue sources from outcome-totals (Shopify, HubSpot, Salesforce)
  // Must be before early returns to preserve hooks ordering
  const revenueSourcesData = useMemo(() => {
    if (!outcomeTotals?.revenueSources) return [];
    return (outcomeTotals.revenueSources as any[])
      .filter((s: any) => s.connected && Number(s.lastTotalRevenue || 0) > 0)
      .map((s: any) => ({
        name: String(s.type || 'Revenue Source').charAt(0).toUpperCase() + String(s.type || '').slice(1),
        revenue: Number(s.lastTotalRevenue || 0),
        type: s.type,
        offsite: !!s.offsite,
        color: s.type === 'shopify' ? '#96bf48' : s.type === 'hubspot' ? '#ff7a59' : s.type === 'salesforce' ? '#00a1e0' : '#6366f1',
      }));
  }, [outcomeTotals]);

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
              <div className="grid gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Campaign Not Found</h1>
              <p className="text-slate-600 dark:text-slate-400">Unable to load campaign data for platform comparison.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const campaignCurrency = (campaign as any)?.currency || 'USD';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: campaignCurrency,
    }).format(amount);
  };

  // Build platform metrics from real connected data
  const buildPlatformMetrics = () => {
    const platforms: any[] = [];
    const num = (v: any) => {
      if (v === null || typeof v === "undefined" || v === "") return 0;
      const n = typeof v === "string" ? parseFloat(v) : Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const ot = outcomeTotals;

    // Use outcome-totals as primary data source when available
    if (ot?.platforms) {
      // LinkedIn Ads
      const li = ot.platforms?.linkedin;
      if (li?.connected || num(li?.spend) > 0) {
        const spend = num(li.spend);
        const impressions = num(li.impressions);
        const clicks = num(li.clicks);
        const conversions = num(li.conversions);
        const revenue = num(li.attributedRevenue);
        platforms.push({
          platform: 'LinkedIn Ads',
          impressions, clicks, conversions, spend, revenue,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          roas: num(li.roas) || (spend > 0 ? revenue / spend : 0),
          roi: num(li.roi) || (spend > 0 ? ((revenue - spend) / spend) * 100 : 0),
          qualityScore: 0, reach: 0, engagement: 0,
          color: '#0077b5',
          isAnalyticsOnly: false,
        });
      }

      // Meta Ads
      const meta = ot.platforms?.meta;
      if (meta?.connected || num(meta?.spend) > 0) {
        const spend = num(meta.spend);
        const impressions = num(meta.impressions);
        const clicks = num(meta.clicks);
        const conversions = num(meta.conversions);
        const revenue = num(meta.attributedRevenue);
        const roas = spend > 0 ? revenue / spend : 0;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        platforms.push({
          platform: 'Meta Ads',
          impressions, clicks, conversions, spend, revenue,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          roas, roi,
          qualityScore: 0, reach: 0, engagement: 0,
          color: '#1877f2',
          isAnalyticsOnly: false,
        });
      }

      // Custom Integration
      const custom = ot.platforms?.customIntegration;
      if (custom?.connected || num(custom?.spend) > 0) {
        const spend = num(custom.spend);
        const impressions = num(custom.impressions);
        const clicks = num(custom.clicks);
        const conversions = num(custom.conversions);
        const revenue = num(custom.revenue);
        const roas = spend > 0 ? revenue / spend : 0;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        platforms.push({
          platform: 'Custom Integration',
          impressions, clicks, conversions, spend, revenue,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          roas, roi,
          qualityScore: 0, reach: 0, engagement: num(custom.sessions),
          color: '#8b5cf6',
          isAnalyticsOnly: false,
        });
      }
    } else {
      // Fallback: use separate API calls when outcome-totals unavailable
      const estimatedAOV = (ga4Data as any)?.averageOrderValue || (linkedInData as any)?.averageOrderValue || (customIntegrationData as any)?.metrics?.averageOrderValue || 50;

      if (linkedInData) {
        const ld = linkedInData as any;
        const spend = num(ld.spend); const impressions = num(ld.impressions);
        const clicks = num(ld.clicks); const conversions = num(ld.conversions);
        const revenue = ld.revenue ?? (conversions * estimatedAOV);
        const roas = ld.roas ?? (spend > 0 ? revenue / spend : 0);
        const roi = ld.roi ?? (spend > 0 ? ((revenue - spend) / spend) * 100 : 0);
        platforms.push({
          platform: 'LinkedIn Ads', impressions, clicks, conversions, spend, revenue,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          roas, roi, qualityScore: 0, reach: num(ld.reach), engagement: num(ld.engagements),
          color: '#0077b5', isAnalyticsOnly: false,
        });
      }

      if ((customIntegrationData as any)?.metrics) {
        const m = (customIntegrationData as any).metrics;
        const spend = parseFloat(m.spend || '0'); const impressions = num(m.pageviews);
        const clicks = num(m.clicks); const conversions = num(m.conversions);
        const revenue = conversions * estimatedAOV;
        const roas = spend > 0 ? revenue / spend : 0;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        platforms.push({
          platform: 'Custom Integration', impressions, clicks, conversions, spend, revenue,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          roas, roi, qualityScore: 0, reach: num(m.reach), engagement: num(m.sessions),
          color: '#8b5cf6', isAnalyticsOnly: false,
        });
      }

      // Meta Ads fallback
      if (metaAnalytics?.summary) {
        const s = metaAnalytics.summary;
        const spend = num(s.totalSpend); const impressions = num(s.totalImpressions);
        const clicks = num(s.totalClicks); const conversions = num(s.totalConversions);
        const revenue = conversions * estimatedAOV;
        const roas = spend > 0 ? revenue / spend : 0;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        platforms.push({
          platform: 'Meta Ads', impressions, clicks, conversions, spend, revenue,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          roas, roi, qualityScore: 0, reach: num(s.totalReach), engagement: 0,
          color: '#1877f2', isAnalyticsOnly: false,
        });
      }
    }

    // GA4 Analytics (analytics-only — revenue + conversions, no spend/clicks)
    const ga4 = ot?.ga4;
    if (ga4?.connected || num(ga4?.revenue) > 0 || num(ga4?.conversions) > 0) {
      platforms.push({
        platform: 'GA4 Analytics',
        impressions: 0, clicks: 0,
        conversions: num(ga4.conversions),
        spend: 0, revenue: num(ga4.revenue),
        ctr: 0, cpc: 0, conversionRate: 0, roas: 0, roi: 0,
        qualityScore: 0, reach: 0, engagement: num(ga4.sessions),
        color: '#e37400',
        isAnalyticsOnly: true,
      });
    }

    return platforms;
  };

  const realPlatformMetrics = buildPlatformMetrics();

  const totalRevenueSourceRevenue = revenueSourcesData.reduce((sum: number, s: any) => sum + s.revenue, 0);

  // Budget allocation pie chart data (advertising platforms only)
  const budgetPieData = realPlatformMetrics
    .filter((p: any) => p.spend > 0 && !p.isAnalyticsOnly)
    .map((p: any) => ({ name: p.platform, value: p.spend, color: p.color }));

  // Generate cost analysis data (exclude analytics-only)
  const costAnalysisData = realPlatformMetrics
    .filter((p: any) => !p.isAnalyticsOnly)
    .map(platform => ({
      name: platform.platform,
      costPerConversion: platform.conversions > 0 ? platform.spend / platform.conversions : 0,
      totalSpend: platform.spend,
      conversions: platform.conversions,
      efficiency: platform.spend > 0 ? ((platform.conversions / platform.spend) * 100).toFixed(2) : '0'
    }));

  // Filter cost analysis data for chart display (only platforms with actual financial data)
  const costAnalysisChartData = costAnalysisData.filter(p => p.totalSpend > 0 || p.conversions > 0);

  // Generate performance rankings (exclude analytics-only platforms)
  const getBestPerformer = (metric: 'roas' | 'roi' | 'conversions' | 'ctr' | 'cpc' | 'conversionRate') => {
    const platformsWithData = realPlatformMetrics.filter((p: any) => !p.isAnalyticsOnly && (p.spend > 0 || p.conversions > 0));
    if (platformsWithData.length === 0) return null;
    
    return platformsWithData.reduce((best, current) => {
      if (metric === 'cpc') {
        // Find lowest CPC among platforms with actual data
        if (current.cpc === 0 && best.cpc === 0) return best; // Both zero, keep first
        if (current.cpc === 0) return current; // Current is zero, it wins
        if (best.cpc === 0) return best; // Best is zero, it wins
        return current.cpc < best.cpc ? current : best; // Both non-zero, pick smaller
      }
      return current[metric] > best[metric] ? current : best;
    });
  };

  const bestROAS = getBestPerformer('roas');
  const bestConversions = getBestPerformer('conversions');
  const bestCTR = getBestPerformer('ctr');

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
                <Link href={`/campaigns/${(campaign as any)?.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Platform Comparison</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
              <Button
                variant={demoMode ? "default" : "outline"}
                size="sm"
                onClick={() => setDemoMode(!demoMode)}
                className="shrink-0"
              >
                <FlaskConical className="w-4 h-4 mr-1" />
                {demoMode ? "Demo On" : "Demo Data"}
              </Button>
            </div>
          </div>

          {demoMode && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
              Showing demo data for testing. Toggle off to see real platform data.
            </div>
          )}

          {/* Platform Comparison Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
              <TabsTrigger value="cost-analysis">Cost Analysis</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Platform Performance Summary Cards */}
              {realPlatformMetrics.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {realPlatformMetrics.map((platform, index) => (
                    <Card key={index} className="border-l-4" style={{ borderLeftColor: platform.color }} data-testid={`platform-card-${index}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          <div className="flex items-center space-x-2">
                            <span>{platform.platform}</span>
                            {platform.isAnalyticsOnly && (
                              <Badge variant="outline" className="text-xs">Analytics</Badge>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Conversions</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{platform.conversions > 0 ? formatNumber(platform.conversions) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Spend</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{platform.spend > 0 ? formatCurrency(platform.spend) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">ROAS</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{platform.roas > 0 ? `${platform.roas.toFixed(2)}x` : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">ROI</span>
                          <span className={`font-semibold ${platform.roi >= 0 && platform.spend > 0 ? 'text-green-600 dark:text-green-400' : platform.roi < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                            {platform.spend > 0 ? `${platform.roi >= 0 ? '+' : ''}${platform.roi.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect platforms (LinkedIn, Meta) or revenue sources (Shopify, HubSpot, Salesforce) to see comparison data.</p>
                  </CardContent>
                </Card>
              )}

              {/* Channel Metrics Summary Table */}
              {realPlatformMetrics.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Channel Performance Overview</CardTitle>
                    <CardDescription>Quick comparison across all connected platforms</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                            <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Platform</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Spend</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Impressions</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Clicks</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">CTR</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Conversions</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Revenue</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">ROAS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {realPlatformMetrics.map((platform: any, index: number) => (
                            <tr key={index} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }}></div>
                                  <span>{platform.platform}</span>
                                  {platform.isAnalyticsOnly && (
                                    <Badge variant="outline" className="text-xs ml-1">Analytics</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="text-right py-3 px-4">{platform.spend > 0 ? formatCurrency(platform.spend) : '—'}</td>
                              <td className="text-right py-3 px-4">{platform.impressions > 0 ? formatNumber(platform.impressions) : '—'}</td>
                              <td className="text-right py-3 px-4">{platform.clicks > 0 ? formatNumber(platform.clicks) : '—'}</td>
                              <td className="text-right py-3 px-4">{platform.ctr > 0 ? `${platform.ctr.toFixed(2)}%` : '—'}</td>
                              <td className="text-right py-3 px-4">{platform.conversions > 0 ? formatNumber(platform.conversions) : '—'}</td>
                              <td className="text-right py-3 px-4">
                                {platform.revenue > 0 ? (
                                  <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(platform.revenue)}</span>
                                ) : '—'}
                              </td>
                              <td className="text-right py-3 px-4">{platform.roas > 0 ? `${platform.roas.toFixed(2)}x` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {(() => {
                            const totSpend = realPlatformMetrics.reduce((s: number, p: any) => s + p.spend, 0);
                            const totImpressions = realPlatformMetrics.reduce((s: number, p: any) => s + p.impressions, 0);
                            const totClicks = realPlatformMetrics.reduce((s: number, p: any) => s + p.clicks, 0);
                            const totConversions = realPlatformMetrics.reduce((s: number, p: any) => s + p.conversions, 0);
                            const totRevenue = realPlatformMetrics.reduce((s: number, p: any) => s + p.revenue, 0);
                            const weightedCtr = totImpressions > 0 ? (totClicks / totImpressions) * 100 : 0;
                            const weightedRoas = totSpend > 0 ? totRevenue / totSpend : 0;
                            return (
                              <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                                <td className="py-3 px-4 text-slate-900 dark:text-white">Total</td>
                                <td className="text-right py-3 px-4">{formatCurrency(totSpend)}</td>
                                <td className="text-right py-3 px-4">{formatNumber(totImpressions)}</td>
                                <td className="text-right py-3 px-4">{formatNumber(totClicks)}</td>
                                <td className="text-right py-3 px-4">{weightedCtr > 0 ? `${weightedCtr.toFixed(2)}%` : '—'}</td>
                                <td className="text-right py-3 px-4">{formatNumber(totConversions)}</td>
                                <td className="text-right py-3 px-4 text-green-600 dark:text-green-400">{formatCurrency(totRevenue)}</td>
                                <td className="text-right py-3 px-4">{weightedRoas > 0 ? `${weightedRoas.toFixed(2)}x` : '—'}</td>
                              </tr>
                            );
                          })()}
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Revenue Tracking Platforms */}
              {revenueSourcesData.length > 0 && (
                <>
                  <div className="border-t pt-6 mt-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Revenue Tracking Platforms</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      Connected e-commerce and CRM platforms — track revenue only, no advertising spend.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {revenueSourcesData.map((source: any, index: number) => (
                      <Card key={index} className="border-l-4" style={{ borderLeftColor: source.color }}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {source.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Total Revenue</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(source.revenue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Classification</span>
                            <Badge variant="outline" className="text-xs">
                              {source.offsite ? 'Offsite' : 'Onsite'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="bg-slate-50 dark:bg-slate-800/50 border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Revenue (All Tracking Sources)</p>
                          <p className="text-xs text-slate-500 mt-1">{revenueSourcesData.length} source{revenueSourcesData.length !== 1 ? 's' : ''} connected</p>
                        </div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(totalRevenueSourceRevenue)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Performance Metrics Tab */}
            <TabsContent value="performance" className="space-y-6">
              {realPlatformMetrics.length > 0 ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Detailed Metrics Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <BarChart3 className="w-5 h-5" />
                          <span>Detailed Performance Metrics</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {realPlatformMetrics.map((platform, index) => (
                            <div key={index} className="p-3 border rounded-lg dark:border-slate-700" data-testid={`metrics-detail-${index}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-slate-900 dark:text-white">{platform.platform}</span>
                                  {platform.isAnalyticsOnly && (
                                    <Badge variant="outline" className="text-xs">Analytics</Badge>
                                  )}
                                </div>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }}></div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div>
                                  <span className="block text-slate-500 font-medium">CTR</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{platform.ctr > 0 ? `${platform.ctr.toFixed(2)}%` : '—'}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 font-medium">CPC</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{platform.cpc > 0 ? formatCurrency(platform.cpc) : '—'}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 font-medium">Conv. Rate</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{platform.conversionRate > 0 ? `${platform.conversionRate.toFixed(2)}%` : '—'}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 font-medium">ROI</span>
                                  <span className={`font-semibold ${platform.roi >= 0 && platform.spend > 0 ? 'text-green-600 dark:text-green-400' : platform.roi < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                    {platform.spend > 0 ? `${platform.roi >= 0 ? '+' : ''}${platform.roi.toFixed(1)}%` : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Efficiency Comparison */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Activity className="w-5 h-5" />
                          <span>Efficiency Comparison</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {realPlatformMetrics.map((platform, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-900 dark:text-white">{platform.platform}</span>
                                <div className="flex items-center space-x-3">
                                  <span className="text-slate-600 dark:text-slate-400">{platform.roas > 0 ? `${platform.roas.toFixed(2)}x ROAS` : '—'}</span>
                                  <span className={`font-medium ${platform.roi >= 0 && platform.spend > 0 ? 'text-green-600 dark:text-green-400' : platform.roi < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                                    {platform.spend > 0 ? `${platform.roi >= 0 ? '+' : ''}${platform.roi.toFixed(1)}% ROI` : '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{
                                    width: `${Math.min((platform.roas / 5) * 100, 100)}%`,
                                    backgroundColor: platform.color
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>CPA: {platform.conversions > 0 && platform.spend > 0 ? formatCurrency(platform.spend / platform.conversions) : '—'}</span>
                                <span>{platform.conversions > 0 ? `${formatNumber(platform.conversions)} Conv.` : '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Platform Volume Comparison */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="w-5 h-5" />
                        <span>Volume & Reach Comparison</span>
                      </CardTitle>
                      <CardDescription>Impressions and engagement across all connected platforms</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {realPlatformMetrics.map((platform, index) => {
                          const maxImpressions = Math.max(...realPlatformMetrics.map(p => p.impressions), 1);
                          const engagementValue = platform.clicks > 0 ? platform.clicks : platform.engagement;
                          const maxEngagement = Math.max(...realPlatformMetrics.map(p => p.clicks > 0 ? p.clicks : p.engagement), 1);

                          return (
                            <div key={index} className="space-y-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }}></div>
                                <span className="font-semibold text-slate-900 dark:text-white">{platform.platform}</span>
                                {platform.isAnalyticsOnly && (
                                  <Badge variant="outline" className="text-xs">Analytics</Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Impressions</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {platform.impressions > 0 ? formatNumber(platform.impressions) : '—'}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full transition-all"
                                      style={{
                                        width: `${platform.impressions > 0 ? Math.min((platform.impressions / maxImpressions) * 100, 100) : 0}%`,
                                        backgroundColor: platform.color
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Clicks / Sessions</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {engagementValue > 0 ? formatNumber(engagementValue) : '—'}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full transition-all"
                                      style={{
                                        width: `${engagementValue > 0 ? Math.min((engagementValue / maxEngagement) * 100, 100) : 0}%`,
                                        backgroundColor: platform.color
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect platforms (LinkedIn, Meta) to see performance metrics.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Cost Analysis Tab */}
            <TabsContent value="cost-analysis" className="space-y-6">
              {realPlatformMetrics.length > 0 ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Cost Efficiency Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <DollarSign className="w-5 h-5" />
                          <span>Cost per Conversion</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {costAnalysisChartData.length > 0 ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={costAnalysisChartData}>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis dataKey="name" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'var(--background)', 
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px' 
                                  }} 
                                  formatter={(value) => [formatCurrency(value as number), "Cost per Conversion"]}
                                />
                                <Bar dataKey="costPerConversion" fill="#f59e0b" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <p>No cost data available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Budget Allocation Pie Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Target className="w-5 h-5" />
                          <span>Budget Allocation</span>
                        </CardTitle>
                        <CardDescription>Spend distribution across advertising platforms</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {budgetPieData.length > 0 ? (
                          <>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={budgetPieData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    labelLine={false}
                                    label={({ name, value }: any) => `${name}: ${formatCurrency(value)}`}
                                    dataKey="value"
                                  >
                                    {budgetPieData.map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="mt-4 space-y-2">
                              {budgetPieData.map((entry: any, index: number) => {
                                const total = budgetPieData.reduce((s: number, e: any) => s + e.value, 0);
                                const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
                                return (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                      <span className="text-slate-700 dark:text-slate-300">{entry.name}</span>
                                    </div>
                                    <span className="text-slate-600 dark:text-slate-400">{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <p>No budget data available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* ROI & ROAS Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5" />
                        <span>Return on Investment (ROI) & Return on Ad Spend (ROAS)</span>
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        ROI shows profit percentage, while ROAS shows revenue multiples
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        {realPlatformMetrics.map((platform, index) => (
                          <div key={index} className="p-4 border rounded-lg dark:border-slate-700 space-y-3" data-testid={`roi-card-${index}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-slate-900 dark:text-white">{platform.platform}</span>
                                {platform.isAnalyticsOnly && (
                                  <Badge variant="outline" className="text-xs">Analytics</Badge>
                                )}
                              </div>
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }}></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-slate-500 mb-1">ROI (Profit %)</div>
                                <div className={`text-2xl font-bold ${platform.spend > 0 ? (platform.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-slate-400'}`}>
                                  {platform.spend > 0 ? `${platform.roi >= 0 ? '+' : ''}${platform.roi.toFixed(1)}%` : '—'}
                                </div>
                                {platform.spend > 0 && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    {platform.roi >= 100 ? 'Excellent' : platform.roi >= 50 ? 'Good' : platform.roi >= 0 ? 'Break-even+' : 'Loss'}
                                  </div>
                                )}
                              </div>

                              <div>
                                <div className="text-xs text-slate-500 mb-1">ROAS (Revenue)</div>
                                <div className={`text-2xl font-bold ${platform.roas > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                  {platform.roas > 0 ? `${platform.roas.toFixed(2)}x` : '—'}
                                </div>
                                {platform.roas > 0 && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    {platform.roas >= 4 ? 'Excellent' : platform.roas >= 3 ? 'Good' : platform.roas >= 1 ? 'Fair' : 'Poor'}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t dark:border-slate-600 text-xs text-slate-600 dark:text-slate-400">
                              <div className="flex justify-between">
                                <span>Total Spend:</span>
                                <span className="font-medium">{platform.spend > 0 ? formatCurrency(platform.spend) : '—'}</span>
                              </div>
                              <div className="flex justify-between mt-1">
                                <span>Conversions:</span>
                                <span className="font-medium">{platform.conversions > 0 ? formatNumber(platform.conversions) : '—'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect platforms (LinkedIn, Meta) to see cost analysis.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              {realPlatformMetrics.length > 0 ? (
                <div className="grid gap-6">
                  {/* AI-Powered Platform Insights */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Brain className="w-5 h-5" />
                        <span>Platform Performance Insights</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Data Source Notice */}
                        {(() => {
                          const platformsWithAdData = realPlatformMetrics.filter((p: any) => !p.isAnalyticsOnly && (p.spend > 0 || p.conversions > 0));
                          const platformsWithoutAdData = realPlatformMetrics.filter((p: any) => p.isAnalyticsOnly || (p.spend === 0 && p.conversions === 0));
                          
                          if (platformsWithoutAdData.length > 0) {
                            return (
                              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid="data-source-notice">
                                <div className="flex items-start space-x-3">
                                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                  <div className="text-sm">
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Data Source Analysis</h4>
                                    <p className="text-blue-700 dark:text-blue-300 mb-2">
                                      Insights and recommendations are based only on platforms with advertising spend data to ensure financial accuracy:
                                    </p>
                                    <div className="space-y-1 text-blue-700 dark:text-blue-300">
                                      {platformsWithAdData.length > 0 && (
                                        <p>
                                          <strong>Included in recommendations:</strong> {platformsWithAdData.map(p => p.platform).join(', ')} 
                                          {platformsWithAdData.length === 1 ? ' (has advertising spend data)' : ' (have advertising spend data)'}
                                        </p>
                                      )}
                                      {platformsWithoutAdData.length > 0 && (
                                        <p>
                                          <strong>Excluded from recommendations:</strong> {platformsWithoutAdData.map(p => p.platform).join(', ')} 
                                          {platformsWithoutAdData.length === 1 
                                            ? ' (website analytics only - no advertising spend)' 
                                            : ' (website analytics only - no advertising spend)'}
                                        </p>
                                      )}
                                    </div>
                                    {platformsWithoutAdData.length > 0 && (
                                      <p className="text-blue-700 dark:text-blue-300 mt-2 italic">
                                        Note: When {platformsWithoutAdData.map(p => p.platform).join(' or ')} {platformsWithoutAdData.length === 1 ? 'has' : 'have'} advertising spend, 
                                        {platformsWithoutAdData.length === 1 ? ' it' : ' they'} will be automatically included in performance comparisons and budget recommendations.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Top Performer Insight */}
                        {bestROAS && (
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg" data-testid="insight-top-performer">
                            <div className="flex items-start space-x-3">
                              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Top Performer: {bestROAS.platform}</h4>
                                <p className="text-sm text-green-700 dark:text-green-300">
                                  {bestROAS.platform} delivers the highest ROAS at {bestROAS.roas.toFixed(2)}x with {formatNumber(bestROAS.conversions)} conversions. 
                                  {bestROAS.roas >= 3 
                                    ? ` This excellent performance suggests allocating 20-30% more budget to scale results.`
                                    : ` Consider optimizing this channel further to improve returns.`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Volume Leader Insight */}
                        {bestConversions && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid="insight-volume-leader">
                            <div className="flex items-start space-x-3">
                              <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Volume Leader: {bestConversions.platform}</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  {bestConversions.platform} generates the most conversions with {formatNumber(bestConversions.conversions)} total. 
                                  {bestConversions.impressions > 0 && ` With ${formatNumber(bestConversions.impressions)} impressions, this platform provides strong reach.`}
                                  {bestConversions.conversions === bestROAS?.conversions 
                                    ? ` Combining high volume with top ROAS makes this your strongest channel.`
                                    : ` Focus on improving efficiency to match top ROAS performance.`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Engagement Quality Insight */}
                        {bestCTR && (
                          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg" data-testid="insight-engagement">
                            <div className="flex items-start space-x-3">
                              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Highest Engagement: {bestCTR.platform}</h4>
                                <p className="text-sm text-purple-700 dark:text-purple-300">
                                  {bestCTR.platform} has the best CTR at {bestCTR.ctr.toFixed(2)}%, indicating strong ad relevance and audience targeting. 
                                  {bestCTR.conversionRate >= 2 
                                    ? ` Combined with ${bestCTR.conversionRate.toFixed(2)}% conversion rate, this channel shows excellent quality traffic.`
                                    : ` Optimize landing pages to convert this engaged traffic more effectively.`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Opportunity/Warning Insight */}
                        {realPlatformMetrics.length > 1 && (() => {
                          // Only consider platforms with actual financial data
                          const platformsWithData = realPlatformMetrics.filter((p: any) => !p.isAnalyticsOnly && (p.spend > 0 || p.conversions > 0));
                          if (platformsWithData.length < 2) return null;
                          
                          const weakest = platformsWithData.reduce((min, p) => p.roas < min.roas ? p : min);
                          const roasGap = bestROAS && bestROAS.roas > 0 ? ((bestROAS.roas - weakest.roas) / bestROAS.roas * 100) : 0;
                          
                          return roasGap > 30 ? (
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg" data-testid="insight-optimization">
                              <div className="flex items-start space-x-3">
                                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                                <div>
                                  <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Optimization Opportunity: {weakest.platform}</h4>
                                  <p className="text-sm text-orange-700 dark:text-orange-300">
                                    {weakest.platform} ROAS of {weakest.roas.toFixed(2)}x is {roasGap.toFixed(0)}% below top performer. 
                                    {weakest.ctr < 1 
                                      ? ` Low CTR (${weakest.ctr.toFixed(2)}%) suggests creative refresh or audience refinement needed.`
                                      : weakest.conversionRate < 2
                                        ? ` Decent engagement but poor conversion suggests landing page optimization required.`
                                        : ` Review targeting and bidding strategy to improve efficiency.`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Strategic Recommendations */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>Strategic Recommendations</span>
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        <strong>Note:</strong> These recommendations are directional guidance based on platform performance data. 
                        Budget allocations and optimization strategies should be validated against your specific business objectives, 
                        profit margins, competitive landscape, and strategic goals before implementation.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Budget Reallocation */}
                        {(() => {
                          // Only include platforms with actual financial data
                          const platformsWithData = realPlatformMetrics.filter((p: any) => !p.isAnalyticsOnly && (p.spend > 0 || p.conversions > 0));
                          return platformsWithData.length > 1 && bestROAS ? (
                            <div className="border-l-4 border-green-500 pl-4">
                              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Budget Reallocation Strategy</h4>
                              <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                {platformsWithData.map((platform, idx) => {
                                  const isTop = platform.platform === bestROAS.platform;
                                  const isWeakest = platform.roas === Math.min(...platformsWithData.map(p => p.roas));
                                  
                                  if (isTop && platform.roas >= 3) {
                                    return (
                                      <li key={idx} data-testid={`rec-budget-${idx}`}>
                                        • Increase {platform.platform} budget by 20-30% (highest ROAS at {platform.roas.toFixed(2)}x)
                                      </li>
                                    );
                                  } else if (isWeakest && platform.roas < 2) {
                                    return (
                                      <li key={idx} data-testid={`rec-budget-${idx}`}>
                                        • Reduce {platform.platform} budget by 15-20% until performance improves (ROAS: {platform.roas.toFixed(2)}x)
                                      </li>
                                    );
                                  } else {
                                    return (
                                      <li key={idx} data-testid={`rec-budget-${idx}`}>
                                        • Maintain {platform.platform} current budget (ROAS: {platform.roas.toFixed(2)}x)
                                      </li>
                                    );
                                  }
                                })}
                              </ul>
                            </div>
                          ) : null;
                        })()}

                        {/* Platform-Specific Optimizations */}
                        {(() => {
                          // Only include platforms with actual financial data
                          const platformsWithData = realPlatformMetrics.filter((p: any) => !p.isAnalyticsOnly && (p.spend > 0 || p.conversions > 0));
                          return platformsWithData.length > 0 ? (
                            <div className="border-l-4 border-blue-500 pl-4">
                              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Platform-Specific Optimizations</h4>
                              <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                {platformsWithData.map((platform, idx) => {
                                  let recommendation = '';
                                  
                                  if (platform.ctr < 1) {
                                    recommendation = `${platform.platform}: Improve CTR (${platform.ctr.toFixed(2)}%) through creative refresh and A/B testing`;
                                  } else if (platform.conversionRate < 2) {
                                    recommendation = `${platform.platform}: Optimize landing pages to improve ${platform.conversionRate.toFixed(2)}% conversion rate`;
                                  } else if (platform.cpc > 5) {
                                    recommendation = `${platform.platform}: Reduce CPC (${formatCurrency(platform.cpc)}) through bid optimization and quality score improvements`;
                                  } else if (platform.roas >= 4) {
                                    recommendation = `${platform.platform}: Expand successful campaigns to similar audiences and regions`;
                                  } else {
                                    recommendation = `${platform.platform}: Test new ad formats and audience segments to scale performance`;
                                  }
                                  
                                  return <li key={idx} data-testid={`rec-optimization-${idx}`}>• {recommendation}</li>;
                                })}
                              </ul>
                            </div>
                          ) : null;
                        })()}

                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect platforms (LinkedIn, Meta) to see insights and recommendations.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
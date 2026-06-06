import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, Loader2, Eye, MousePointer, DollarSign, Target } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InstagramAnalytics() {
  const [, params] = useRoute("/campaigns/:id/instagram-analytics");
  const campaignId = params?.id;

  const { data: connection, isLoading, error } = useQuery<any>({
    queryKey: [`/api/instagram/${campaignId}/connection`],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/instagram/${campaignId}/connection`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load Instagram connection");
      }
      return response.json();
    },
  });

  const connected = connection?.connected === true && Array.isArray(connection?.selectedCampaignIds) && connection.selectedCampaignIds.length > 0;
  const { data: dailyMetrics, isLoading: metricsLoading, error: metricsError } = useQuery<any>({
    queryKey: [`/api/instagram/${campaignId}/daily-metrics`, "30days"],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/instagram/${campaignId}/daily-metrics?dateRange=30days`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load Instagram metrics");
      }
      return response.json();
    },
  });
  const overviewTotals = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    return rows.reduce((acc: any, row: any) => {
      acc.impressions += Number(row.impressions || 0);
      acc.clicks += Number(row.clicks || 0);
      acc.spend += Number(row.spend || 0);
      acc.conversions += Number(row.conversions || 0);
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
  }, [dailyMetrics]);
  const latestImportedAt = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    const latest = rows
      .map((row: any) => row.importedAt ? new Date(row.importedAt).getTime() : 0)
      .filter((value: number) => Number.isFinite(value) && value > 0)
      .sort((a: number, b: number) => b - a)[0];
    return latest ? new Date(latest).toLocaleString() : null;
  }, [dailyMetrics]);
  const campaignBreakdown = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    const byCampaign = new Map<string, any>();
    rows.forEach((row: any) => {
      const id = String(row.instagramCampaignId || "").trim();
      if (!id) return;
      const current = byCampaign.get(id) || {
        instagramCampaignId: id,
        instagramCampaignName: row.instagramCampaignName || id,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
      };
      current.impressions += Number(row.impressions || 0);
      current.clicks += Number(row.clicks || 0);
      current.spend += Number(row.spend || 0);
      current.conversions += Number(row.conversions || 0);
      byCampaign.set(id, current);
    });
    return Array.from(byCampaign.values()).sort((a, b) => b.spend - a.spend);
  }, [dailyMetrics]);
  const hasRows = connected && Array.isArray(dailyMetrics?.rows) && dailyMetrics.rows.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="ghost" size="sm" data-testid="button-back-to-campaign">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaign
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <SiInstagram className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Instagram Ads Analytics</h1>
                <p className="text-muted-foreground">Campaign-scoped Instagram source analytics</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Connection Status</CardTitle>
                    <CardDescription>Access is limited to the persisted Instagram source for this campaign.</CardDescription>
                  </div>
                  {isLoading ? (
                    <Badge variant="secondary">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Checking
                    </Badge>
                  ) : connected ? (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-700">Connected</Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading Instagram connection...
                  </div>
                ) : error ? (
                  <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 dark:text-red-300">{(error as Error).message}</p>
                  </div>
                ) : connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Instagram analytics tabs will use selected source-backed Instagram rows only.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(connection.selectedCampaignIds || []).map((id: string) => (
                        <Badge key={id} variant="outline">{id}</Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">
                      Connect Instagram Ads from the campaign Connected Platforms section before opening Instagram analytics.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {connected && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="campaign-breakdown">Campaign Breakdown</TabsTrigger>
                </TabsList>
                {metricsError && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-red-700 dark:text-red-300">{(metricsError as Error).message}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {latestImportedAt && (
                  <p className="text-xs text-muted-foreground">Latest Instagram row import: {latestImportedAt}</p>
                )}
                <TabsContent value="overview" className="space-y-4">
                  {metricsError ? null : metricsLoading ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading source-backed Instagram metrics...
                        </div>
                      </CardContent>
                    </Card>
                  ) : hasRows ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Impressions", value: overviewTotals.impressions.toLocaleString(), Icon: Eye },
                        { label: "Clicks", value: overviewTotals.clicks.toLocaleString(), Icon: MousePointer },
                        { label: "Spend", value: `$${overviewTotals.spend.toFixed(2)}`, Icon: DollarSign },
                        { label: "Conversions", value: overviewTotals.conversions.toLocaleString(), Icon: Target },
                      ].map(({ label, value, Icon }) => (
                        <Card key={label}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                <p className="text-2xl font-semibold text-foreground">{value}</p>
                              </div>
                              <Icon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-muted-foreground">No selected source-backed Instagram metric rows are available yet.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="campaign-breakdown" className="space-y-4">
                  {metricsError ? null : metricsLoading ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading selected Instagram campaign rows...
                        </div>
                      </CardContent>
                    </Card>
                  ) : campaignBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {campaignBreakdown.map((campaign: any) => (
                        <Card key={campaign.instagramCampaignId}>
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-medium text-foreground">{campaign.instagramCampaignName}</p>
                                <p className="text-xs text-muted-foreground">{campaign.instagramCampaignId}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                                <div>
                                  <p className="text-muted-foreground">Impressions</p>
                                  <p className="font-medium">{campaign.impressions.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Clicks</p>
                                  <p className="font-medium">{campaign.clicks.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Spend</p>
                                  <p className="font-medium">${campaign.spend.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Conversions</p>
                                  <p className="font-medium">{campaign.conversions.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-muted-foreground">No selected Instagram campaign rows are available yet.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

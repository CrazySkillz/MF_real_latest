import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertCircle, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";
import { AddSpendWizardModal } from "@/components/AddSpendWizardModal";

type MimosaasTrackingSnapshot = {
  reportingDate: string;
  reportingTimeZone: string;
  users: number;
  sessions: number;
  engagedSessions: number;
  pageviews: number;
  conversions: number;
  engagementRate: string;
  conversionRate: string;
  revenue: string | null;
  spend: string | null;
  currency: string;
  revenueStatus: "available" | "unavailable";
  spendStatus: "available" | "unavailable";
  publishedAt: string;
};

type SnapshotResponse = { success: true; snapshot: MimosaasTrackingSnapshot | null };
type FinancialSource = { id: string; displayName?: string | null };
type FinancialSourcesResponse = {
  success: true;
  revenueSources: FinancialSource[];
  spendSources: FinancialSource[];
};

const formatReportingDate = (value: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)
    : value;
};

const formatRate = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}%` : "Unavailable";
};

const formatFinancial = (value: string | null, currency: string, status: "available" | "unavailable") => {
  const parsed = value === null ? NaN : Number(value);
  if (status !== "available" || !Number.isFinite(parsed)) return "Unavailable";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(parsed);
  } catch {
    return "Unavailable";
  }
};

const formatSources = (sources: FinancialSource[] | undefined, unavailable: boolean) => {
  if (unavailable) return "Source status unavailable";
  if (!sources) return "";
  if (sources.length === 0) return "No source configured";
  const names = sources.map((source) => String(source.displayName || "").trim() || "Google Sheets");
  return `${sources.length === 1 ? "Source" : "Sources"}: ${names.join(", ")}`;
};

export function MimosaasTrackingOverview({ campaignId, currency }: { campaignId: string; currency: string }) {
  const queryClient = useQueryClient();
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const { data, isLoading, isError } = useQuery<SnapshotResponse>({
    queryKey: ["/api/campaigns", campaignId, "mimosaas-tracking", "daily-snapshot"],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/mimosaas-tracking/daily-snapshot`, { credentials: "include" });
      if (!response.ok) throw new Error("Finalized Mimosaas Tracking data is unavailable");
      return response.json();
    },
  });
  const sourceQueryKey = ["/api/campaigns", campaignId, "mimosaas-tracking", "financial-sources"] as const;
  const { data: sourcesData, isError: sourcesError } = useQuery<FinancialSourcesResponse>({
    queryKey: sourceQueryKey,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/mimosaas-tracking/financial-sources`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Mimosaas Tracking financial sources are unavailable");
      return response.json();
    },
  });
  const snapshot = data?.snapshot ?? null;
  const revenueSources = formatSources(sourcesData?.revenueSources, sourcesError);
  const spendSources = formatSources(sourcesData?.spendSources, sourcesError);
  const refreshSources = () => void queryClient.invalidateQueries({ queryKey: sourceQueryKey });

  return (
    <>
    <Card className="border-green-200 dark:border-green-800" data-testid="mimosaas-tracking-overview">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-orange-500" />
            <div>
              <CardTitle className="text-base">Mimosaas Tracking</CardTitle>
              <CardDescription>Finalized daily website metrics</CardDescription>
            </div>
          </div>
          <Badge className="bg-blue-600 text-white hover:bg-blue-700">Connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-28">
        {isLoading ? (
          <div className="flex min-h-20 items-center justify-center" aria-label="Loading finalized Mimosaas Tracking metrics">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex min-h-20 items-center gap-2 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Finalized tracking data is temporarily unavailable.
          </div>
        ) : !snapshot ? (
          <div className="flex min-h-20 flex-col items-start justify-center gap-3 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
            <p>No finalized daily snapshot is available yet.</p>
            <div className="space-y-1 text-xs">
              <p className="min-h-4">{revenueSources ? `Revenue — ${revenueSources}` : ""}</p>
              <p className="min-h-4">{spendSources ? `Spend — ${spendSources}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setRevenueOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Revenue
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSpendOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Spend
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Latest finalized day: <span className="font-medium text-foreground">{formatReportingDate(snapshot.reportingDate)}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {[
                ["Users", snapshot.users.toLocaleString("en-US")],
                ["Sessions", snapshot.sessions.toLocaleString("en-US")],
                ["Pageviews", snapshot.pageviews.toLocaleString("en-US")],
                ["Conversions", snapshot.conversions.toLocaleString("en-US")],
                ["Engagement Rate", formatRate(snapshot.engagementRate)],
                ["Conversion Rate", formatRate(snapshot.conversionRate)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Add Google Sheets Revenue" onClick={() => setRevenueOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatFinancial(snapshot.revenue, snapshot.currency, snapshot.revenueStatus)}
                </p>
                <p className="mt-1 min-h-4 text-xs text-muted-foreground">{revenueSources}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Spend</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Add Google Sheets Spend" onClick={() => setSpendOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatFinancial(snapshot.spend, snapshot.currency, snapshot.spendStatus)}
                </p>
                <p className="mt-1 min-h-4 text-xs text-muted-foreground">{spendSources}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    <AddRevenueWizardModal
      open={revenueOpen}
      onOpenChange={setRevenueOpen}
      campaignId={campaignId}
      currency={currency}
      dateRange="to_date"
      platformContext="mimosaas_tracking"
      initialStep="sheets_choose"
      lockInitialStep
      hideCrmSources
      onSuccess={() => {
        setRevenueOpen(false);
        refreshSources();
      }}
    />
    <AddSpendWizardModal
      open={spendOpen}
      onOpenChange={setSpendOpen}
      campaignId={campaignId}
      currency={currency}
      dateRange="to_date"
      platformContext="mimosaas_tracking"
      initialStep="sheets_choose"
      lockInitialStep
      onProcessed={() => {
        setSpendOpen(false);
        refreshSources();
      }}
    />
    </>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";
import { AddSpendWizardModal } from "@/components/AddSpendWizardModal";
import {
  DollarSign, TrendingUp, Plus, ExternalLink, Trash2,
  CheckCircle2, XCircle, Database, ShoppingCart, BarChart3,
  FileSpreadsheet, Upload, Pencil, Settings
} from "lucide-react";

interface ConnectedPlatformStatus {
  conversionValue?: string | null;
  id: string;
  name: string;
  connected: boolean;
  connectedCampaignLevel?: boolean;
  analyticsPath?: string | null;
  lastConnectedAt?: string | null;
}

interface DataSourcesTabProps {
  campaignId: string;
  campaign: any;
  connectedPlatformStatuses: ConnectedPlatformStatus[];
  onDisconnectPlatform?: (platformKey: string, platformLabel: string) => void;
}

type PlatformContextType = 'ga4' | 'linkedin' | 'meta';

const PLATFORM_META: Record<string, { label: string; color: string; platformContext: PlatformContextType; statusId: string }> = {
  linkedin: { label: 'LinkedIn Ads', color: '#0077b5', platformContext: 'linkedin', statusId: 'linkedin' },
  meta: { label: 'Meta Ads', color: '#1877f2', platformContext: 'meta', statusId: 'facebook' },
  ga4: { label: 'Google Analytics', color: '#e37400', platformContext: 'ga4', statusId: 'google-analytics' },
};

const SOURCE_TYPE_ICONS: Record<string, { icon: typeof ShoppingCart; label: string }> = {
  shopify: { icon: ShoppingCart, label: 'Shopify' },
  hubspot: { icon: Database, label: 'HubSpot' },
  salesforce: { icon: Database, label: 'Salesforce' },
  google_sheets: { icon: FileSpreadsheet, label: 'Google Sheets' },
  csv: { icon: Upload, label: 'CSV Import' },
  manual: { icon: Pencil, label: 'Manual Entry' },
};

function getPlatformLabel(ctx: string): string {
  if (ctx === 'linkedin') return 'LinkedIn';
  if (ctx === 'meta') return 'Meta';
  if (ctx === 'ga4') return 'GA4';
  return ctx;
}

function getPlatformBadgeColor(ctx: string): string {
  if (ctx === 'linkedin') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (ctx === 'meta') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
  return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
}

export function DataSourcesTab({ campaignId, campaign, connectedPlatformStatuses, onDisconnectPlatform }: DataSourcesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const campaignCurrency = (campaign as any)?.currency || 'USD';

  // Wizard state
  const [revenueWizardOpen, setRevenueWizardOpen] = useState(false);
  const [revenueWizardContext, setRevenueWizardContext] = useState<PlatformContextType>('ga4');
  const [revenueWizardSource, setRevenueWizardSource] = useState<any>(null);
  const [spendWizardOpen, setSpendWizardOpen] = useState(false);
  const [platformSelectorOpen, setPlatformSelectorOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'revenue' | 'spend'; id: string; name: string; platformContext?: string } | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<{ key: string; label: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Fetch all data sources
  const { data: dataSources, isLoading } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/all-data-sources`],
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/all-data-sources`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
    enabled: !!campaignId,
  });

  // Connected ad platforms (only those actually connected)
  const connectedAdPlatforms = useMemo(() => {
    const platforms: Array<{ id: string; label: string; platformContext: PlatformContextType; color: string; analyticsPath: string | null }> = [];
    for (const [key, meta] of Object.entries(PLATFORM_META)) {
      const status = connectedPlatformStatuses.find(s => s.id === meta.statusId);
      if (status?.connected) {
        platforms.push({
          id: key,
          label: meta.label,
          platformContext: meta.platformContext,
          color: meta.color,
          analyticsPath: status.analyticsPath || null,
        });
      }
    }
    return platforms;
  }, [connectedPlatformStatuses]);

  // Revenue sources grouped by platform
  const revenueSources = useMemo(() => {
    if (!dataSources?.revenueSources) return [];
    return (dataSources.revenueSources as any[]).filter((s: any) => s.isActive !== false);
  }, [dataSources]);

  // Spend sources
  const spendSources = useMemo(() => {
    if (!dataSources?.spendSources) return [];
    return (dataSources.spendSources as any[]).filter((s: any) => s.isActive !== false);
  }, [dataSources]);

  // CRM connections
  const crmConnections = dataSources?.crmConnections || {};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: campaignCurrency }).format(amount);
  };

  const handleAddRevenue = () => {
    setRevenueWizardSource(null);
    if (connectedAdPlatforms.length === 1) {
      // Only one platform connected — skip selector
      setRevenueWizardContext(connectedAdPlatforms[0].platformContext);
      setRevenueWizardOpen(true);
    } else if (connectedAdPlatforms.length > 1) {
      setPlatformSelectorOpen(true);
    } else {
      toast({ title: "No platforms connected", description: "Connect an ad platform first from the Overview tab.", variant: "destructive" });
    }
  };

  const handleEditRevenue = (source: any) => {
    const ctx = String(source.platformContext || 'ga4').trim() as PlatformContextType;
    setRevenueWizardContext(ctx);
    setRevenueWizardSource(source);
    setRevenueWizardOpen(true);
  };

  const handleDeleteSource = async () => {
    if (!deleteConfirm) return;
    try {
      const { type, id, platformContext } = deleteConfirm;
      let url = '';
      if (type === 'revenue') {
        url = `/api/campaigns/${campaignId}/revenue-sources/${id}?platformContext=${platformContext || 'ga4'}`;
      } else {
        url = `/api/campaigns/${campaignId}/spend-sources/${id}`;
      }
      const resp = await fetch(url, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Failed to delete');
      const result = await resp.json().catch(() => ({}));
      toast({
        title: "Deleted",
        description: result?.revenueTrackingDisabled
          ? `${deleteConfirm.name} has been removed. Revenue tracking has been disabled.`
          : `${deleteConfirm.name} has been removed.`,
      });
      // Broad invalidation — covers all views that depend on revenue/spend data
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/all-data-sources`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/kpis", campaignId], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/benchmarks", campaignId], exact: false });
      // Invalidate LinkedIn imports so "Revenue Tracking Active" card updates
      void queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports'], exact: false });
      // Invalidate revenue-totals and spend-totals
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals`], exact: false });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to delete source", variant: "destructive" });
    }
    setDeleteConfirm(null);
  };

  const handleWizardSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/all-data-sources`] });
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false });
    void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/kpis", campaignId], exact: false });
    void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/benchmarks", campaignId], exact: false });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mt-8"></div>
          <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section A: Connected Ad Platforms */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Connected Ad Platforms</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Platforms sending advertising data to this campaign. Connect new platforms from the Overview tab.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(PLATFORM_META).map(([key, meta]) => {
            const status = connectedPlatformStatuses.find(s => s.id === meta.statusId);
            const connected = !!status?.connected;
            return (
              <Card key={key} className={`border-l-4 ${connected ? '' : 'opacity-60'}`} style={{ borderLeftColor: connected ? meta.color : '#94a3b8' }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {connected ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-400" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{meta.label}</p>
                        <p className="text-xs text-slate-500">
                          {connected ? 'Connected' : 'Not connected'}
                          {status?.lastConnectedAt && ` · ${new Date(status.lastConnectedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {connected && status?.analyticsPath && (
                        <Link href={status.analyticsPath}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Analytics
                          </Button>
                        </Link>
                      )}
                      {connected && onDisconnectPlatform && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title={`Disconnect ${meta.label}`}
                          onClick={() => onDisconnectPlatform(key, meta.label)}
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Section B: Revenue Sources */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Revenue Sources</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Connected e-commerce and CRM platforms feeding revenue data into ad platform analytics.
            </p>
          </div>
          <Button onClick={handleAddRevenue} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Revenue Source
          </Button>
        </div>

        {revenueSources.length > 0 ? (
          <div className="space-y-3">
            {revenueSources.map((source: any) => {
              const sourceType = String(source.sourceType || source.type || '').toLowerCase();
              const iconInfo = SOURCE_TYPE_ICONS[sourceType] || { icon: Database, label: sourceType || 'Source' };
              const IconComp = iconInfo.icon;
              const ctx = String(source.platformContext || 'ga4').trim();
              const displayName = source.displayName || iconInfo.label;
              const cfg = typeof source.mappingConfig === 'string' ? (() => { try { return JSON.parse(source.mappingConfig); } catch { return null; } })() : source.mappingConfig;
              const revenue = parseFloat(cfg?.lastTotalRevenue || source.lastTotalRevenue || 0);

              return (
                <Card key={source.id} className="hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                          <IconComp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-slate-900 dark:text-white">{displayName}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPlatformBadgeColor(ctx)}`}>
                              {getPlatformLabel(ctx)} Revenue
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 mt-0.5">
                            <span className="text-xs text-slate-500">{iconInfo.label}</span>
                            {revenue > 0 && (
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                {formatCurrency(revenue)}
                              </span>
                            )}
                            {source.connectedAt && (
                              <span className="text-xs text-slate-400">
                                Added {new Date(source.connectedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditRevenue(source)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => setDeleteConfirm({ type: 'revenue', id: source.id, name: displayName, platformContext: ctx })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <DollarSign className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No revenue sources connected</p>
              <p className="text-xs text-slate-500 mb-4">
                Connect Shopify, HubSpot, Salesforce, or import via CSV/Google Sheets to track revenue.
              </p>
              <Button variant="outline" size="sm" onClick={handleAddRevenue}>
                <Plus className="w-4 h-4 mr-1" />
                Add Revenue Source
              </Button>
            </CardContent>
          </Card>
        )}

        {/* CRM connection status summary */}
        {(crmConnections.shopify || crmConnections.hubspot || crmConnections.salesforce) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {crmConnections.shopify && (
              <Badge variant="outline" className="text-xs">
                <ShoppingCart className="w-3 h-3 mr-1" />
                Shopify connected
              </Badge>
            )}
            {crmConnections.hubspot && (
              <Badge variant="outline" className="text-xs">
                <Database className="w-3 h-3 mr-1" />
                HubSpot connected
              </Badge>
            )}
            {crmConnections.salesforce && (
              <Badge variant="outline" className="text-xs">
                <Database className="w-3 h-3 mr-1" />
                Salesforce connected
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Section C: Spend Sources */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Spend Sources</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sources providing advertising spend data (manual entry, CSV, Google Sheets).
            </p>
          </div>
          <Button onClick={() => setSpendWizardOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Spend Source
          </Button>
        </div>

        {spendSources.length > 0 ? (
          <div className="space-y-3">
            {spendSources.map((source: any) => {
              const sourceType = String(source.sourceType || '').toLowerCase();
              const iconInfo = SOURCE_TYPE_ICONS[sourceType] || { icon: Upload, label: sourceType || 'Spend Source' };
              const IconComp = iconInfo.icon;
              const displayName = source.displayName || iconInfo.label;
              const cfg = typeof source.mappingConfig === 'string' ? (() => { try { return JSON.parse(source.mappingConfig); } catch { return null; } })() : source.mappingConfig;
              const totalSpend = parseFloat(cfg?.lastTotalSpend || source.lastTotalSpend || 0);

              return (
                <Card key={source.id} className="hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                          <IconComp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{displayName}</p>
                          <div className="flex items-center space-x-3 mt-0.5">
                            <span className="text-xs text-slate-500">{iconInfo.label}</span>
                            {totalSpend > 0 && (
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {formatCurrency(totalSpend)}
                              </span>
                            )}
                            {source.connectedAt && (
                              <span className="text-xs text-slate-400">
                                Added {new Date(source.connectedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => setDeleteConfirm({ type: 'spend', id: source.id, name: displayName })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <BarChart3 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No spend sources connected</p>
              <p className="text-xs text-slate-500 mb-4">
                Import spend data via manual entry, CSV upload, or Google Sheets.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSpendWizardOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Spend Source
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Platform Selector Dialog */}
      <Dialog open={platformSelectorOpen} onOpenChange={setPlatformSelectorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Platform</DialogTitle>
            <DialogDescription>
              Which ad platform should this revenue source feed into?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {connectedAdPlatforms.map(p => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                onClick={() => {
                  setRevenueWizardContext(p.platformContext);
                  setRevenueWizardSource(null);
                  setPlatformSelectorOpen(false);
                  setRevenueWizardOpen(true);
                }}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                  <span className="font-medium text-slate-900 dark:text-white">{p.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the {deleteConfirm?.type} source and its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSource} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revenue Wizard Modal */}
      <AddRevenueWizardModal
        open={revenueWizardOpen}
        onOpenChange={setRevenueWizardOpen}
        campaignId={campaignId}
        currency={campaignCurrency}
        dateRange="to_date"
        platformContext={revenueWizardContext}
        initialSource={revenueWizardSource || undefined}
        onSuccess={handleWizardSuccess}
      />

      {/* Spend Wizard Modal */}
      <AddSpendWizardModal
        campaignId={campaignId}
        open={spendWizardOpen}
        onOpenChange={setSpendWizardOpen}
        currency={campaignCurrency}
      />
    </div>
  );
}

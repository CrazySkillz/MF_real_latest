// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

/**
 * Split out from `pages/linkedin-analytics.tsx` to prevent single-file OOM.
 * Uses `any` props intentionally to avoid tight coupling while we continue refactoring.
 */
export function LinkedInCampaignDetailsModal(props: any) {
  const {
    isCampaignDetailsModalOpen,
    setIsCampaignDetailsModalOpen,
    selectedCampaignDetails,
    aggregated,
    campaignData,
    benchmarks,
    renderPerformanceBadge,
    formatNumber,
    formatCurrency,
    formatPercentage,
  } = props;

  return (
    <Dialog open={isCampaignDetailsModalOpen} onOpenChange={setIsCampaignDetailsModalOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            {selectedCampaignDetails?.name}
          </DialogTitle>
          <DialogDescription>
            <Badge
              variant={selectedCampaignDetails?.status === "active" ? "default" : "secondary"}
              className={
                selectedCampaignDetails?.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : ""
              }
            >
              {selectedCampaignDetails?.status}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Core Metrics Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Core Metrics</h4>
            <div className="grid grid-cols-3 gap-4">
              {/* Impressions */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Impressions</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(selectedCampaignDetails?.metrics.impressions || 0)}
                </p>
              </div>
              {/* Reach */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Reach</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(selectedCampaignDetails?.metrics.reach || 0)}
                </p>
              </div>
              {/* Clicks */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Clicks</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(selectedCampaignDetails?.metrics.clicks || 0)}
                </p>
              </div>
              {/* Engagements */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Engagements</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(selectedCampaignDetails?.metrics.engagements || 0)}
                </p>
              </div>
              {/* Spend */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Spend</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatCurrency(selectedCampaignDetails?.metrics.spend || 0)}
                </p>
              </div>
              {/* Conversions */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Conversions</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(selectedCampaignDetails?.metrics.conversions || 0)}
                </p>
              </div>
              {/* Leads */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Leads</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(selectedCampaignDetails?.metrics.leads || 0)}
                </p>
              </div>
              {/* Video Views */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Video Views</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(selectedCampaignDetails?.metrics.videoviews || selectedCampaignDetails?.metrics.videoViews || 0)}
                </p>
              </div>
              {/* Viral Impressions */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Viral Impressions</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(
                    selectedCampaignDetails?.metrics.viralimpressions || selectedCampaignDetails?.metrics.viralImpressions || 0
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Derived Metrics Section */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Derived Metrics</h4>
            <div className="grid grid-cols-3 gap-4">
              {/* CTR */}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CTR (Click-Through Rate)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatPercentage(
                    selectedCampaignDetails?.metrics.impressions > 0
                      ? (selectedCampaignDetails?.metrics.clicks / selectedCampaignDetails?.metrics.impressions) * 100
                      : 0
                  )}
                </p>
              </div>
              {/* CPC */}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPC (Cost Per Click)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(
                    selectedCampaignDetails?.metrics.clicks > 0
                      ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.clicks
                      : 0
                  )}
                </p>
              </div>
              {/* CPM */}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPM (Cost Per Mille)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(
                    selectedCampaignDetails?.metrics.impressions > 0
                      ? (selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.impressions) * 1000
                      : 0
                  )}
                </p>
              </div>
              {/* CVR */}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CVR (Conversion Rate)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatPercentage(
                    selectedCampaignDetails?.metrics.clicks > 0
                      ? (selectedCampaignDetails?.metrics.conversions / selectedCampaignDetails?.metrics.clicks) * 100
                      : 0
                  )}
                </p>
              </div>
              {/* CPA */}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPA (Cost Per Acquisition)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(
                    selectedCampaignDetails?.metrics.conversions > 0
                      ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.conversions
                      : 0
                  )}
                </p>
              </div>
              {/* CPL */}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPL (Cost Per Lead)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(
                    selectedCampaignDetails?.metrics.leads > 0
                      ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.leads
                      : 0
                  )}
                </p>
              </div>
              {/* ER */}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ER (Engagement Rate)</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatPercentage(
                    selectedCampaignDetails?.metrics.impressions > 0
                      ? (selectedCampaignDetails?.metrics.engagements / selectedCampaignDetails?.metrics.impressions) * 100
                      : 0
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue Analytics Section - Only shown if conversion value is set */}
          {aggregated?.hasRevenueTracking === 1 &&
            selectedCampaignDetails &&
            (() => {
              const campaignConversions = selectedCampaignDetails.metrics.conversions || 0;
              const campaignSpend = selectedCampaignDetails.metrics.spend || 0;
              const campaignLeads = selectedCampaignDetails.metrics.leads || 0;
              const conversionValue = aggregated.conversionValue || 0;

              const campaignRevenue = campaignConversions * conversionValue;
              const campaignProfit = campaignRevenue - campaignSpend;
              const campaignROAS = campaignSpend > 0 ? campaignRevenue / campaignSpend : 0;
              const campaignROI = campaignSpend > 0 ? ((campaignRevenue - campaignSpend) / campaignSpend) * 100 : 0;
              const campaignProfitMargin = campaignRevenue > 0 ? (campaignProfit / campaignRevenue) * 100 : 0;
              const campaignRevenuePerLead = campaignLeads > 0 ? campaignRevenue / campaignLeads : 0;

              return (
                <div className="space-y-3 pt-4 border-t border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Revenue Analytics</h4>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      💰 {formatCurrency(conversionValue)}/conversion
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Total Revenue */}
                    <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Revenue</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(campaignRevenue)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {campaignConversions.toLocaleString()} conversions × {formatCurrency(conversionValue)}
                      </p>
                    </div>

                    {/* ROAS */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROAS (Return on Ad Spend)</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{campaignROAS.toFixed(2)}x</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {formatCurrency(campaignRevenue)} / {formatCurrency(campaignSpend)}
                      </p>
                    </div>

                    {/* ROI */}
                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROI (Return on Investment)</p>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{campaignROI.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{campaignROI >= 0 ? "Profitable" : "Loss"}</p>
                    </div>

                    {/* Profit */}
                    <div
                      className={`p-4 rounded-lg border ${
                        campaignProfit >= 0
                          ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                      }`}
                    >
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Profit</p>
                      <p
                        className={`text-lg font-bold ${
                          campaignProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(campaignProfit)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Revenue - Spend</p>
                    </div>

                    {/* Profit Margin */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Profit Margin</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{campaignProfitMargin.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Profit / Revenue</p>
                    </div>

                    {/* Revenue Per Lead */}
                    {campaignLeads > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Revenue Per Lead</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(campaignRevenuePerLead)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{campaignLeads.toLocaleString()} leads</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Performance Indicators - Only shown when industry is selected */}
          {campaignData?.industry && selectedCampaignDetails && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Performance Analysis</h4>
              <div className="flex items-center gap-3 flex-wrap">
                {(() => {
                  const campaignName = selectedCampaignDetails.name;

                  const impressions = selectedCampaignDetails.metrics.impressions || 0;
                  const clicks = selectedCampaignDetails.metrics.clicks || 0;
                  const spend = selectedCampaignDetails.metrics.spend || 0;
                  const conversions = selectedCampaignDetails.metrics.conversions || 0;
                  const engagements = selectedCampaignDetails.metrics.engagements || 0;

                  const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

                  return (
                    <>
                      {/* ER (Engagement Rate) Badge */}
                      {Array.isArray(benchmarks) &&
                        (() => {
                          const erBenchmark = benchmarks.find(
                            (b: any) => b.metric?.toLowerCase() === "er" && b.linkedInCampaignName === campaignName
                          );
                          if (erBenchmark) {
                            return renderPerformanceBadge("er", engagementRate, "higher-better");
                          }
                          return null;
                        })()}

                      {/* ROI Badge */}
                      {Array.isArray(benchmarks) &&
                        aggregated?.hasRevenueTracking === 1 &&
                        (() => {
                          const roiBenchmark = benchmarks.find(
                            (b: any) => b.metric?.toLowerCase() === "roi" && b.linkedInCampaignName === campaignName
                          );
                          if (roiBenchmark) {
                            const campaignRevenue = conversions * (aggregated.conversionValue || 0);
                            const campaignROI = spend > 0 ? ((campaignRevenue - spend) / spend) * 100 : 0;
                            return renderPerformanceBadge("roi", campaignROI, "higher-better");
                          }
                          return null;
                        })()}

                      {/* ROAS Badge */}
                      {Array.isArray(benchmarks) &&
                        aggregated?.hasRevenueTracking === 1 &&
                        (() => {
                          const roasBenchmark = benchmarks.find(
                            (b: any) => b.metric?.toLowerCase() === "roas" && b.linkedInCampaignName === campaignName
                          );
                          if (roasBenchmark) {
                            const campaignRevenue = conversions * (aggregated.conversionValue || 0);
                            const campaignROAS = spend > 0 ? campaignRevenue / spend : 0;
                            return renderPerformanceBadge("roas", campaignROAS, "higher-better");
                          }
                          return null;
                        })()}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


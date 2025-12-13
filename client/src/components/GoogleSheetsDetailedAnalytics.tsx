import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Target, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface GoogleSheetsDetailedAnalyticsProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleSheetsDetailedAnalytics({
  campaignId,
  isOpen,
  onClose
}: GoogleSheetsDetailedAnalyticsProps) {
  // Fetch Google Sheets data
  const { data: sheetsData, isLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId && isOpen,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) {
        return { calculatedConversionValues: [] };
      }
      const data = await response.json();
      return {
        ...data,
        calculatedConversionValues: data.calculatedConversionValues || []
      };
    },
  });

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Google Sheets Detailed Analytics</DialogTitle>
            <DialogDescription>
              Loading analytics data...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <BarChart3 className="w-6 h-6 animate-pulse text-slate-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Google Sheets Detailed Analytics</DialogTitle>
          <DialogDescription>
            View conversion values, campaign matching, and data processing details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conversion Value Calculation Feedback */}
          {sheetsData?.calculatedConversionValues && sheetsData.calculatedConversionValues.length > 0 && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Conversion Values Calculated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sheetsData.calculatedConversionValues.map((cv: any, idx: number) => {
                    const platformName = cv.platform === 'linkedin' ? 'LinkedIn' : 
                                       cv.platform === 'facebook_ads' ? 'Facebook Ads' :
                                       cv.platform === 'google_ads' ? 'Google Ads' :
                                       cv.platform.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {platformName}:
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 ml-2">
                            ${cv.conversionValue}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2">
                            (from {cv.conversions.toLocaleString()} conversions)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Revenue metrics are now available!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Matching Status */}
          {sheetsData?.matchingInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Matching Status</CardTitle>
                <CardDescription>
                  How your Google Sheets data was matched with campaign data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sheetsData.matchingInfo.method === 'campaign_name_platform' && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-700 dark:text-green-400 mb-1">
                        Campaign matched successfully
                      </p>
                      {sheetsData.matchingInfo.matchedCampaigns.length > 0 && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Matched: <strong>{sheetsData.matchingInfo.matchedCampaigns.join(', ')}</strong>
                        </p>
                      )}
                      {sheetsData.matchingInfo.unmatchedCampaigns.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          Other campaigns found: {sheetsData.matchingInfo.unmatchedCampaigns.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {sheetsData.matchingInfo.method === 'platform_only' && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                        Using all {sheetsData.matchingInfo.platform ? sheetsData.matchingInfo.platform.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'platform'} data
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {sheetsData.matchingInfo.unmatchedCampaigns.length > 1 ? (
                          <>
                            Found {sheetsData.matchingInfo.unmatchedCampaigns.length} {sheetsData.matchingInfo.platform ? sheetsData.matchingInfo.platform.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'platform'} campaigns. 
                            <span className="block mt-2 text-amber-600 dark:text-amber-400 text-xs">
                              💡 Tip: Use the same campaign name in Google Sheets for more accurate conversion value calculation.
                            </span>
                          </>
                        ) : (
                          `No campaign name match found. Using all ${sheetsData.matchingInfo.platform ? sheetsData.matchingInfo.platform.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'platform'} rows.`
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {sheetsData.matchingInfo.method === 'all_rows' && (
                  <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <AlertCircle className="w-5 h-5 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Using all rows
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        No Platform column detected. Using all rows from the sheet.
                      </p>
                    </div>
                  </div>
                )}

                {/* Matching Method Info */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Matching method: <strong>{sheetsData.matchingInfo.method}</strong>
                    {sheetsData.matchingInfo.totalFilteredRows > 0 && (
                      <span className="ml-2">
                        • {sheetsData.matchingInfo.totalFilteredRows.toLocaleString()} rows processed
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Data Message */}
          {(!sheetsData?.calculatedConversionValues || sheetsData.calculatedConversionValues.length === 0) && 
           (!sheetsData?.matchingInfo) && (
            <Card>
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600 dark:text-slate-400">
                  No analytics data available yet. Make sure your Google Sheets is connected and column mappings are configured.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


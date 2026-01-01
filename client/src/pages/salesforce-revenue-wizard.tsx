import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { SalesforceRevenueWizard } from "@/components/SalesforceRevenueWizard";
import { Button } from "@/components/ui/button";

export default function SalesforceRevenueWizardPage() {
  const [, params] = useRoute("/campaigns/:id/salesforce-revenue-wizard");
  const [, setLocation] = useLocation();
  const campaignId = params?.id;

  const returnTo = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("returnTo") || (campaignId ? `/campaigns/${campaignId}/linkedin-analytics` : "/campaigns");
  }, [campaignId]);

  if (!campaignId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-3xl mx-auto">
              <div className="text-slate-600 dark:text-slate-300">Missing campaign id.</div>
              <Button className="mt-4" onClick={() => setLocation("/campaigns")}>
                Back to Campaigns
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Salesforce Revenue Metrics</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Follow the guided steps to connect Salesforce and map Opportunities to calculate ROI/ROAS.
                </p>
              </div>
              <Button variant="outline" onClick={() => setLocation(returnTo)}>
                Back
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <SalesforceRevenueWizard
                campaignId={campaignId}
                onBack={() => setLocation(returnTo)}
                onClose={() => setLocation(returnTo)}
                onSuccess={() => {
                  // Wizard already shows confirmation messaging; after success, return user to analytics.
                  setLocation(returnTo);
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



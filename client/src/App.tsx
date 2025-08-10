import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Campaigns from "@/pages/campaigns";
import CampaignDetail from "@/pages/campaign-detail";
import CampaignPerformance from "@/pages/campaign-performance";
import PlatformComparison from "@/pages/platform-comparison";
import TrendAnalysis from "@/pages/trend-analysis";
import ExecutiveSummary from "@/pages/executive-summary";
import FinancialAnalysis from "@/pages/financial-analysis";
import GA4Metrics from "@/pages/ga4-metrics";
import GoogleSheetsData from "@/pages/google-sheets-data";
import KPIs from "@/pages/kpis";
import PlatformKPIs from "@/pages/platform-kpis";
import Audiences from "@/pages/audiences";
import Analytics from "@/pages/analytics";
import Integrations from "@/pages/integrations";
import GoogleAuthCallback from "@/pages/auth/google-callback";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/campaigns/:id" component={CampaignDetail} />
      <Route path="/campaigns/:id/performance" component={CampaignPerformance} />
      <Route path="/campaigns/:id/platform-comparison" component={PlatformComparison} />
      <Route path="/campaigns/:id/trend-analysis" component={TrendAnalysis} />
      <Route path="/campaigns/:id/executive-summary" component={ExecutiveSummary} />
      <Route path="/campaigns/:id/financial" component={FinancialAnalysis} />
      <Route path="/campaigns/:id/ga4-metrics" component={GA4Metrics} />
      <Route path="/campaigns/:id/google-sheets-data" component={GoogleSheetsData} />
      <Route path="/campaigns/:id/kpis" component={KPIs} />
      <Route path="/platforms/:platformType/kpis" component={PlatformKPIs} />
      <Route path="/audiences" component={Audiences} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/auth/google/callback" component={GoogleAuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

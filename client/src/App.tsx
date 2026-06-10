import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  ClerkLoaded,
  ClerkLoading,
} from "@clerk/clerk-react";
import { ClientProvider, useClient } from "@/lib/clientContext";
import Dashboard from "@/pages/dashboard";
import Campaigns from "@/pages/campaigns";
const CampaignDetail = lazy(() => import("@/pages/campaign-detail"));
const CampaignPerformance = lazy(() => import("@/pages/campaign-performance"));
const PlatformComparison = lazy(() => import("@/pages/platform-comparison"));
import ComingSoon from "@/pages/coming-soon";
const TrendAnalysis = lazy(() => import("@/pages/trend-analysis"));
const ExecutiveSummary = lazy(() => import("@/pages/executive-summary"));
const FinancialAnalysis = lazy(() => import("@/pages/financial-analysis"));
const GA4Metrics = lazy(() => import("@/pages/ga4-metrics"));
const GoogleSheetsData = lazy(() => import("@/pages/google-sheets-data"));
const LinkedInAnalytics = lazy(() => import("@/pages/linkedin-analytics"));
const MetaAnalytics = lazy(() => import("@/pages/meta-analytics"));
const GoogleAdsAnalytics = lazy(() => import("@/pages/google-ads-analytics"));
const InstagramAnalytics = lazy(() => import("@/pages/instagram-analytics"));
const TikTokAnalytics = lazy(() => import("@/pages/tiktok-analytics"));
const CustomIntegrationAnalytics = lazy(() => import("@/pages/custom-integration-analytics"));
const KPIs = lazy(() => import("@/pages/kpis"));
const PlatformKPIs = lazy(() => import("@/pages/platform-kpis"));
const Audiences = lazy(() => import("@/pages/audiences"));
const Reports = lazy(() => import("@/pages/reports"));
const Notifications = lazy(() => import("@/pages/notifications"));
import GoogleAuthCallback from "@/pages/auth/google-callback";
import WelcomePage from "@/pages/welcome";
import ClientsPage from "@/pages/clients";
import HomePage from "@/pages/home";
import NotFound from "@/pages/not-found";

function PageLoading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthPage() {
  const [location, setLocation] = useLocation();
  const isSignUp = location === "/sign-up";

  // Redirect any non-auth URL to /sign-in
  if (location !== "/sign-in" && location !== "/sign-up") {
    setLocation("/sign-in");
    return null;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      {isSignUp ? (
        <SignUp
          signInUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      ) : (
        <SignIn
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      )}
    </div>
  );
}

// Gates the app to the welcome page when no clients exist
function WelcomeGate({ children }: { children: React.ReactNode }) {
  const { clients, isLoading } = useClient();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Always allow Home, /clients, /welcome, and /auth routes through
  const alwaysAllowed = location === "/" || location === "/clients" || location === "/welcome" || location.startsWith("/auth/");
  if (alwaysAllowed) return <>{children}</>;

  // No clients → redirect to Home
  if (clients.length === 0) {
    setLocation("/");
    return null;
  }

  return <>{children}</>;
}

function ProtectedRouter() {
  return (
    <ClientProvider>
      <WelcomeGate>
        <Suspense fallback={<PageLoading />}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/welcome" component={HomePage} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/clients" component={ClientsPage} />
            <Route path="/campaigns" component={Campaigns} />
            <Route path="/campaigns/:id" component={CampaignDetail} />
            <Route path="/campaigns/:id/performance" component={CampaignPerformance} />
            <Route path="/campaigns/:id/platform-comparison" component={PlatformComparison} />
            <Route path="/campaigns/:id/trend-analysis" component={TrendAnalysis} />
            <Route path="/campaigns/:id/executive-summary" component={ExecutiveSummary} />
            <Route path="/campaigns/:id/financial-analysis" component={FinancialAnalysis} />
            <Route path="/campaigns/:id/ga4-metrics" component={GA4Metrics} />
            <Route path="/campaigns/:id/google-sheets-data" component={GoogleSheetsData} />
            <Route path="/campaigns/:id/linkedin-analytics" component={LinkedInAnalytics} />
            <Route path="/campaigns/:id/meta-analytics" component={MetaAnalytics} />
            <Route path="/campaigns/:id/google-ads-analytics" component={GoogleAdsAnalytics} />
            <Route path="/campaigns/:id/instagram-analytics" component={InstagramAnalytics} />
            <Route path="/campaigns/:id/tiktok-analytics" component={TikTokAnalytics} />
            <Route path="/campaigns/:id/custom-integration-analytics" component={CustomIntegrationAnalytics} />
            <Route path="/integrations/:id/analytics" component={CustomIntegrationAnalytics} />
            <Route path="/campaigns/:id/kpis" component={KPIs} />
            <Route path="/platforms/:platformType/kpis" component={PlatformKPIs} />
            <Route path="/linkedin-analytics" component={LinkedInAnalytics} />
            <Route path="/audiences" component={Audiences} />
            <Route path="/reports" component={Reports} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/auth/google/callback" component={GoogleAuthCallback} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </WelcomeGate>
    </ClientProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />

          {/* Loading state while Clerk initializes */}
          <ClerkLoading>
            <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          </ClerkLoading>

          <ClerkLoaded>
            {/* Public auth routes */}
            <SignedOut>
              <Switch>
                <Route path="/sign-in" component={AuthPage} />
                <Route path="/sign-up" component={AuthPage} />
                {/* Redirect everything else to sign-in */}
                <Route>
                  <AuthPage />
                </Route>
              </Switch>
            </SignedOut>

            {/* Protected app routes */}
            <SignedIn>
              <ProtectedRouter />
            </SignedIn>
          </ClerkLoaded>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

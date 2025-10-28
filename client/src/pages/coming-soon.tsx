import { useRoute, Link } from "wouter";
import { ArrowLeft, Clock, TrendingUp } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ComingSoon() {
  const [, params] = useRoute("/campaigns/:id/trend-analysis");
  const campaignId = params?.id;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
              </div>
            </div>

            {/* Coming Soon Card */}
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-2xl">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <TrendingUp className="w-20 h-20 text-blue-500" />
                      <Clock className="w-8 h-8 text-amber-500 absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">
                    Trend Analysis
                  </CardTitle>
                  <CardDescription className="text-lg mt-2">
                    Coming Soon
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                  <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                    We're working on bringing you powerful industry trend analysis and market intelligence. 
                    This feature will help you track keyword trends, compare against industry benchmarks, 
                    and gain valuable insights for strategic decision-making.
                  </p>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      This feature is currently under development and will be available in a future update.
                    </p>
                  </div>

                  <div className="pt-4">
                    <Link href={`/campaigns/${campaignId}`}>
                      <Button size="lg" data-testid="button-explore-other-features">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Explore Other Features
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

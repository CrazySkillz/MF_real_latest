import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, BarChart3, Bell, Settings } from "lucide-react";
import { Integration } from "@shared/schema";

interface IntegrationPanelProps {
  onIntegrationClick: (platform: string) => void;
}

export default function IntegrationPanel({ onIntegrationClick }: IntegrationPanelProps) {
  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const connectedIntegrations = integrations.filter(integration => integration.connected);

  const availableIntegrations = [
    {
      id: "facebook",
      name: "Facebook Ads",
      description: "Connect your Facebook advertising account",
      icon: "fab fa-facebook",
      color: "text-blue-600",
    },
    {
      id: "google-analytics",
      name: "Google Analytics",
      description: "Track website performance and conversions",
      icon: "fab fa-google",
      color: "text-red-500",
    },
    {
      id: "linkedin",
      name: "LinkedIn Ads",
      description: "B2B advertising and lead generation",
      icon: "fab fa-linkedin",
      color: "text-blue-700",
    },
    {
      id: "twitter",
      name: "X (Twitter) Ads",
      description: "Social media advertising and engagement",
      icon: "fab fa-twitter",
      color: "text-blue-400",
    },
    {
      id: "tiktok",
      name: "TikTok Ads",
      description: "Short-form video advertising and engagement",
      icon: "fab fa-tiktok",
      color: "text-black",
    },
  ];

  const connectedPlatformIds = connectedIntegrations.map(integration => integration.platform);
  const pendingIntegrations = availableIntegrations.filter(
    integration => !connectedPlatformIds.includes(integration.id)
  );

  return (
    <div className="space-y-6">
      {/* Add New Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Add Integration</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingIntegrations.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500">All available platforms are connected!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingIntegrations.map((integration) => (
                <button
                  key={integration.id}
                  onClick={() => onIntegrationClick(integration.id)}
                  className="integration-card group"
                >
                  <div className="flex items-center space-x-3">
                    <i className={`${integration.icon} ${integration.color} text-xl`}></i>
                    <div className="text-left">
                      <div className="font-medium text-slate-900">{integration.name}</div>
                      <div className="text-sm text-slate-500">{integration.description}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <BarChart3 className="w-4 h-4 mr-3 text-primary" />
              Generate Report
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <Bell className="w-4 h-4 mr-3 text-primary" />
              Set up Alert
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <Settings className="w-4 h-4 mr-3 text-primary" />
              Account Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

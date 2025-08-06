import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import IntegrationModal from "@/components/modals/integration-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Trash2, CheckCircle, AlertCircle, Target } from "lucide-react";
import { Link } from "wouter";
import { Integration } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Integrations() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration removed",
        description: "The integration has been successfully disconnected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove integration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const availablePlatforms = [
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
      name: "Twitter Ads",
      description: "Social media advertising and engagement",
      icon: "fab fa-twitter",
      color: "text-blue-400",
    },
  ];

  const handleAddIntegration = (platform: string) => {
    setSelectedPlatform(platform);
    setIsModalOpen(true);
  };

  const handleDeleteIntegration = (id: string) => {
    if (window.confirm("Are you sure you want to disconnect this integration?")) {
      deleteIntegrationMutation.mutate(id);
    }
  };

  const connectedPlatforms = integrations.filter(integration => integration.connected);
  const connectedPlatformIds = connectedPlatforms.map(integration => integration.platform);
  
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="max-w-4xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">Integrations</h1>
              <p className="text-slate-600 mt-1">Connect your marketing platforms to centralize your data</p>
            </div>

            {/* Connected Integrations */}
            {connectedPlatforms.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Connected Platforms</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {connectedPlatforms.map((integration) => {
                    const platform = availablePlatforms.find(p => p.id === integration.platform);
                    return (
                      <Card key={integration.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {platform && (
                                <i className={`${platform.icon} ${platform.color} text-xl`} />
                              )}
                              <div>
                                <CardTitle className="text-lg">{integration.name}</CardTitle>
                                <CardDescription>
                                  {platform?.description}
                                </CardDescription>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="text-sm text-slate-500">
                              Last sync: {integration.lastSync 
                                ? new Date(integration.lastSync).toLocaleDateString()
                                : "Never"
                              }
                            </div>
                            
                            {/* Navigation Tabs */}
                            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                              <div className="text-xs px-2 py-1 bg-white rounded shadow-sm">
                                Overview
                              </div>
                              <Link href={`/platforms/${integration.platform}/kpis`}>
                                <div className="text-xs px-2 py-1 hover:bg-white hover:shadow-sm rounded cursor-pointer text-slate-600 hover:text-slate-900">
                                  KPIs
                                </div>
                              </Link>
                              <div className="text-xs px-2 py-1 hover:bg-white hover:shadow-sm rounded cursor-pointer text-slate-600 hover:text-slate-900">
                                Benchmarks
                              </div>
                              <div className="text-xs px-2 py-1 hover:bg-white hover:shadow-sm rounded cursor-pointer text-slate-600 hover:text-slate-900">
                                ROIs
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Link href={`/platforms/${integration.platform}/kpis`}>
                                <Button variant="outline" size="sm">
                                  <Target className="w-4 h-4 mr-1" />
                                  Manage KPIs
                                </Button>
                              </Link>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm">
                                  <Settings className="w-4 h-4 mr-1" />
                                  Settings
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleDeleteIntegration(integration.id)}
                                  disabled={deleteIntegrationMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Disconnect
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Integrations */}
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Available Platforms</h2>
              {availablePlatforms.filter(platform => !connectedPlatformIds.includes(platform.id)).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">All platforms connected!</h3>
                    <p className="text-slate-500">You've successfully connected all available marketing platforms.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availablePlatforms
                    .filter(platform => !connectedPlatformIds.includes(platform.id))
                    .map((platform) => (
                      <Card key={platform.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <i className={`${platform.icon} ${platform.color} text-xl`} />
                              <div>
                                <CardTitle className="text-lg">{platform.name}</CardTitle>
                                <CardDescription>{platform.description}</CardDescription>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-slate-50 text-slate-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Not Connected
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Button 
                            onClick={() => handleAddIntegration(platform.id)}
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Connect {platform.name}
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Empty State */}
            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-slate-500 mt-2">Loading integrations...</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <IntegrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        platform={selectedPlatform}
      />
    </div>
  );
}

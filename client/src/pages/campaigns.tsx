import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Play, Pause, Edit, Trash2, BarChart3, DollarSign, Target, Eye, ArrowLeft, CheckCircle } from "lucide-react";
import { SiFacebook, SiGoogle, SiLinkedin, SiX } from "react-icons/si";
import { Campaign, insertCampaignSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const campaignFormSchema = insertCampaignSchema.extend({
  name: z.string().min(1, "Campaign name is required"),
  clientWebsite: z.string().optional(),
  label: z.string().optional(),
  budget: z.string().optional(),
}).omit({
  type: true,
  platform: true,
  impressions: true,
  clicks: true,
  spend: true,
  status: true,
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface DataConnectorsStepProps {
  onComplete: (selectedPlatforms: string[]) => void;
  onBack: () => void;
  isLoading: boolean;
}

const platforms = [
  {
    id: "google-analytics",
    name: "Google Analytics",
    icon: SiGoogle,
    color: "text-orange-500",
    description: "Connect your Google Analytics account",
    type: "credentials",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  },
  {
    id: "facebook",
    name: "Facebook Ads",
    icon: SiFacebook,
    color: "text-blue-600",
    description: "Connect your Facebook Ads account",
    type: "credentials"
  },
  {
    id: "google-ads",
    name: "Google Ads",
    icon: SiGoogle,
    color: "text-red-500",
    description: "Connect your Google Ads account",
    type: "credentials"
  },
  {
    id: "linkedin",
    name: "LinkedIn Ads",
    icon: SiLinkedin,
    color: "text-blue-700",
    description: "Connect your LinkedIn Ads account",
    type: "credentials"
  },
  {
    id: "twitter",
    name: "X (Twitter) Ads",
    icon: SiX,
    color: "text-slate-900 dark:text-white",
    description: "Connect your X (Twitter) Ads account",
    type: "credentials"
  }
];

function DataConnectorsStep({ onComplete, onBack, isLoading, campaignData }: DataConnectorsStepProps & { campaignData: CampaignFormData }) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [ga4Properties, setGA4Properties] = useState<Array<{id: string, name: string}>>([]);
  const [selectedGA4Property, setSelectedGA4Property] = useState<string>('');
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const { toast } = useToast();

  const handlePlatformConnect = async (platformId: string) => {
    if (connectedPlatforms.includes(platformId)) {
      // Already connected, just toggle selection
      setSelectedPlatforms(prev => 
        prev.includes(platformId) 
          ? prev.filter(id => id !== platformId)
          : [...prev, platformId]
      );
      return;
    }

    // Start connection process
    if (platformId === 'google-analytics') {
      await handleGA4Connect();
    } else {
      // For other platforms, show coming soon message
      toast({
        title: "Coming Soon",
        description: `${platforms.find(p => p.id === platformId)?.name} integration will be available soon.`,
      });
    }
  };


  const handleGA4Connect = async () => {
    setIsConnecting(prev => ({ ...prev, 'google-analytics': true }));
    
    try {
      // Get OAuth URL from backend
      const response = await fetch("/api/auth/google/url", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          campaignId: 'temp-campaign-setup',
          returnUrl: window.location.href 
        })
      });
      
      const data = await response.json();
      
      if (data.setup_required) {
        // Demo mode - show message about needing OAuth setup
        toast({
          title: "OAuth Setup Required",
          description: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Replit secrets for real GA4 integration",
          duration: 5000,
        });
        return;
      }
      
      if (data.oauth_url) {
        // Open OAuth popup
        const popup = window.open(
          data.oauth_url,
          'ga4-oauth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for OAuth completion
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            checkOAuthResult();
          }
        }, 1000);

        // Listen for OAuth success message
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GA4_OAUTH_SUCCESS') {
            popup?.close();
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            handleOAuthSuccess(event.data.properties);
          } else if (event.data.type === 'GA4_OAUTH_ERROR') {
            popup?.close();
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            handleOAuthError(event.data.error);
          }
        };

        window.addEventListener('message', messageHandler);
      }
    } catch (error) {
      console.error('OAuth setup error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to start Google Analytics connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(prev => ({ ...prev, 'google-analytics': false }));
    }
  };

  const checkOAuthResult = async () => {
    try {
      const response = await fetch('/api/ga4/check-connection/temp-campaign-setup');
      const data = await response.json();
      
      if (data.connected && data.properties) {
        handleOAuthSuccess(data.properties);
      }
    } catch (error) {
      console.error('Failed to check OAuth result:', error);
    }
  };

  const handleOAuthSuccess = (properties: Array<{id: string, name: string}>) => {
    setGA4Properties(properties);
    setShowPropertySelector(true);
    
    toast({
      title: "Google Analytics Connected!",
      description: "Please select a GA4 property to start pulling metrics."
    });
  };

  const handleOAuthError = (error: string) => {
    toast({
      title: "Connection Failed",
      description: error || "Failed to connect to Google Analytics",
      variant: "destructive"
    });
  };

  const handlePropertySelection = async () => {
    if (!selectedGA4Property) return;

    try {
      const response = await fetch('/api/ga4/select-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: 'temp-campaign-setup',
          propertyId: selectedGA4Property
        })
      });

      if (response.ok) {
        setConnectedPlatforms(prev => [...prev, 'google-analytics']);
        setSelectedPlatforms(prev => [...prev, 'google-analytics']);
        setShowPropertySelector(false);
        
        toast({
          title: "Property Connected!",
          description: "Starting to pull real-time metrics from your GA4 property."
        });
      }
    } catch (error) {
      console.error('Property selection error:', error);
      toast({
        title: "Selection Failed",
        description: "Failed to connect to the selected property.",
        variant: "destructive"
      });
    }
  };



  const handleComplete = () => {
    // Get platform names for display
    const connectedPlatformNames = selectedPlatforms.map(id => {
      const platform = platforms.find(p => p.id === id);
      return platform ? platform.name : id;
    });
    onComplete(connectedPlatformNames);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">Connect Your Marketing Platforms</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect your marketing platforms to pull real-time metrics and performance data for this campaign.
          </p>
        </div>
        
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const isSelected = selectedPlatforms.includes(platform.id);
          const isConnected = connectedPlatforms.includes(platform.id);
          const platformConnecting = isConnecting[platform.id] || false;
          
          return (
            <div key={platform.id} className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-center space-x-3">
                  <Icon className={`w-6 h-6 ${platform.color}`} />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {platform.name}
                      {isConnected && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </div>
                    <div className="text-sm text-slate-500">{platform.description}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isConnected && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handlePlatformConnect(platform.id)}
                    />
                  )}
                  
                  {!isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlatformConnect(platform.id)}
                      disabled={platformConnecting}
                    >
                      {platformConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleComplete}
          disabled={selectedPlatforms.length === 0 || isLoading}
        >
          Continue with {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''}
        </Button>
      </div>
      
      {/* GA4 Property Selection Modal */}
      {showPropertySelector && (
        <Dialog open={showPropertySelector} onOpenChange={setShowPropertySelector}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select GA4 Property</DialogTitle>
              <DialogDescription>
                Choose which Google Analytics property to connect for this campaign
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-3">
                {ga4Properties.map((property) => (
                  <label key={property.id} className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="property"
                      value={property.id}
                      checked={selectedGA4Property === property.id}
                      onChange={(e) => setSelectedGA4Property(e.target.value)}
                      className="text-blue-600"
                    />
                    <div>
                      <div className="font-medium">{property.name}</div>
                      <div className="text-sm text-gray-500">ID: {property.id}</div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPropertySelector(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handlePropertySelection}
                  disabled={!selectedGA4Property}
                  className="flex-1"
                >
                  Connect Property
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function Campaigns() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showConnectorsStep, setShowConnectorsStep] = useState(false);
  const [campaignData, setCampaignData] = useState<CampaignFormData | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const { toast } = useToast();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  // Handle OAuth callback when returning from Google
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleConnected = urlParams.get('google_connected');
    const accessToken = urlParams.get('access_token');
    const error = urlParams.get('error');
    
    if (googleConnected === 'true' || error) {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Restore campaign data from sessionStorage
      const pendingCampaignData = sessionStorage.getItem('pendingCampaign');
      const ga4CredsData = sessionStorage.getItem('ga4Credentials');
      
      if (pendingCampaignData) {
        try {
          const restored = JSON.parse(pendingCampaignData);
          
          if (googleConnected === 'true' && accessToken && ga4CredsData) {
            const ga4Creds = JSON.parse(ga4CredsData);
            
            // Complete GA4 connection with access token
            // Mark GA4 as connected - this function needs to be defined
            
            // Success - show modal with restored data
            setCampaignData(restored);
            setIsCreateModalOpen(true);
            setShowConnectorsStep(true);
            
            sessionStorage.removeItem('ga4Credentials');
          } else if (googleConnected === 'true') {
            // Regular OAuth success without GA4 credentials
            setCampaignData(restored);
            setIsCreateModalOpen(true);
            setShowConnectorsStep(true);
            
            toast({
              title: "Google Analytics Connected",
              description: "Successfully connected to your Google Analytics account",
            });
          } else if (error) {
            toast({
              title: "Connection Failed",
              description: `OAuth Error: ${error}`,
              variant: "destructive",
            });
          }
          
          sessionStorage.removeItem('pendingCampaign');
        } catch (e) {
          console.error('Failed to restore campaign data:', e);
        }
      }
    }
  }, [toast]);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      clientWebsite: "",
      label: "",
      budget: "",
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: CampaignFormData & { platform?: string; status?: string; type?: string; impressions?: number; clicks?: number; spend?: string }) => {
      const response = await apiRequest("POST", "/api/campaigns", {
        name: data.name,
        clientWebsite: data.clientWebsite || null,
        label: data.label || null,
        budget: data.budget ? parseFloat(data.budget) : null,
        type: data.type || "campaign",
        platform: data.platform || "manual",
        impressions: data.impressions || 0,
        clicks: data.clicks || 0,
        spend: data.spend || "0",
        status: data.status || "active",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campaign created",
        description: "Your new campaign has been created successfully.",
      });
      setIsCreateModalOpen(false);
      setShowConnectorsStep(false);
      setCampaignData(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: string } }) => {
      const response = await apiRequest("PATCH", `/api/campaigns/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campaign updated",
        description: "Campaign status has been updated.",
      });
    },
  });

  const handleSubmit = (data: CampaignFormData) => {
    setCampaignData(data);
    setShowConnectorsStep(true);
  };

  const handleConnectorsComplete = (selectedPlatforms: string[]) => {
    if (campaignData) {
      // Create campaign with connected platforms data - no artificial metrics
      const campaignWithPlatforms = {
        ...campaignData,
        platform: selectedPlatforms.join(', '), // Store connected platforms
        status: "active" as const,
        type: "campaign" as const,
        impressions: 0, // Start with 0 - will be populated from real API data
        clicks: 0,      // Start with 0 - will be populated from real API data  
        spend: "0",     // Backend expects string, not number
      };
      createCampaignMutation.mutate(campaignWithPlatforms);
    }
  };

  const handleBackToForm = () => {
    setShowConnectorsStep(false);
  };

  const toggleCampaignStatus = (campaign: Campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    updateCampaignMutation.mutate({
      id: campaign.id,
      data: { status: newStatus }
    });
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value));
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "facebook":
        return "fab fa-facebook text-blue-600";
      case "google ads":
        return "fab fa-google text-red-500";
      case "linkedin":
        return "fab fa-linkedin text-blue-700";
      case "twitter":
        return "fab fa-twitter text-blue-400";
      default:
        return "fas fa-ad text-slate-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-accent/10 text-accent border-accent/20">Active</Badge>;
      case "paused":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Paused</Badge>;
      case "completed":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };



  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Campaign Management</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Create, manage, and optimize your marketing campaigns</p>
              </div>
              
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className={`${showConnectorsStep ? "sm:max-w-4xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto`}>
                  <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
                    <DialogTitle>
                      {showConnectorsStep ? "Connect Data Sources" : "Create New Campaign"}
                    </DialogTitle>
                    <DialogDescription>
                      {showConnectorsStep 
                        ? "Select social media platforms and enter your credentials to connect your data sources."
                        : "Set up a new marketing campaign with your preferred settings."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!showConnectorsStep ? (
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Campaign Name *</Label>
                      <Input
                        id="name"
                        placeholder="Enter campaign name"
                        {...form.register("name")}
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="clientWebsite">Client's Website (optional)</Label>
                      <Input
                        id="clientWebsite"
                        type="url"
                        placeholder="https://example.com"
                        {...form.register("clientWebsite")}
                      />
                      {form.formState.errors.clientWebsite && (
                        <p className="text-sm text-destructive">{form.formState.errors.clientWebsite.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="label">Label (optional)</Label>
                      <Input
                        id="label"
                        placeholder="Add a label or tag"
                        {...form.register("label")}
                      />
                      {form.formState.errors.label && (
                        <p className="text-sm text-destructive">{form.formState.errors.label.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget (optional)</Label>
                      <Input
                        id="budget"
                        type="number"
                        step="0.01"
                        placeholder="Enter budget amount in USD"
                        {...form.register("budget")}
                      />
                      {form.formState.errors.budget && (
                        <p className="text-sm text-destructive">{form.formState.errors.budget.message}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => setIsCreateModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1"
                      >
                        Next
                      </Button>
                    </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="max-h-[60vh] overflow-y-auto pr-2">
                        <DataConnectorsStep 
                          onComplete={handleConnectorsComplete}
                          onBack={handleBackToForm}
                          isLoading={createCampaignMutation.isPending}
                          campaignData={campaignData!}
                        />
                      </div>
                      
                      {/* Move buttons outside scrollable area */}
                      <div className="flex items-center space-x-3 pt-4 border-t bg-background">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex-1"
                          onClick={handleBackToForm}
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>
                        <Button 
                          type="button" 
                          className="flex-1"
                          onClick={() => {
                            // Get selected platforms from the form
                            const selectedPlatforms = ['facebook', 'google-analytics']; // For now, just demo platforms
                            handleConnectorsComplete(selectedPlatforms);
                          }}
                          disabled={createCampaignMutation.isPending}
                        >
                          {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                          <CheckCircle className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>


          </div>

          {/* Campaigns Cards */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Campaigns</h2>
                <p className="text-slate-600 dark:text-slate-400">Manage and monitor your marketing campaigns</p>
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-lg font-medium text-slate-900 dark:text-white mb-2">No campaigns found</div>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">Get started by creating your first marketing campaign</p>
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((campaign) => (
                  <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{campaign.name}</h3>
                            <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                              {campaign.platform?.includes('Google Analytics') && (
                                <SiGoogle className="w-4 h-4 text-orange-500" />
                              )}
                              {campaign.platform?.includes('Facebook') && (
                                <SiFacebook className="w-4 h-4 text-blue-600" />
                              )}
                              {campaign.platform?.includes('LinkedIn') && (
                                <SiLinkedin className="w-4 h-4 text-blue-700" />
                              )}
                              {campaign.platform?.includes('Twitter') && (
                                <SiX className="w-4 h-4 text-slate-900 dark:text-white" />
                              )}
                              <span>{campaign.platform || "Manual"}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            {getStatusBadge(campaign.status)}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Budget: {formatCurrency(campaign.budget)}
                          </div>
                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleCampaignStatus(campaign);
                              }}
                              disabled={updateCampaignMutation.isPending}
                            >
                              {campaign.status === "active" ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => e.preventDefault()}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => e.preventDefault()}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
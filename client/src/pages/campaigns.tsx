import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { GA4AuthModal } from "@/components/GA4AuthModal";
import SimpleOAuth from "@/components/SimpleOAuth";
import { queryClient } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [credentials, setCredentials] = useState<Record<string, { apiKey?: string; secret?: string; propertyId?: string; measurementId?: string }>>({});
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [showGA4AuthModal, setShowGA4AuthModal] = useState(false);
  const [ga4ConnectPlatformId, setGA4ConnectPlatformId] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const handleCredentialChange = (platformId: string, field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        [field]: value
      }
    }));
  };

  const handleGA4Connect = async (platformId: string) => {
    const creds = credentials[platformId];
    if (!creds?.propertyId) {
      toast({
        title: "Property ID Required",
        description: "Please enter your GA4 Property ID to connect",
        variant: "destructive",
      });
      return;
    }

    // Open the GA4 authentication modal
    setGA4ConnectPlatformId(platformId);
    setShowGA4AuthModal(true);
  };

  const handleGA4AuthSubmit = async (accessToken: string) => {
    const platformId = ga4ConnectPlatformId;
    const creds = credentials[platformId];
    
    if (!creds?.propertyId) return;

    setIsConnecting(true);
    
    try {
      const { ga4Client } = await import('@/lib/ga4-client');
      
      // Set the access token
      ga4Client.setAccessToken(accessToken);
      
      // Test the connection with the provided property ID
      const isValid = await ga4Client.testConnection(creds.propertyId);
      
      if (isValid) {
        setConnectedPlatforms(prev => [...prev, platformId]);
        if (!selectedPlatforms.includes(platformId)) {
          setSelectedPlatforms(prev => [...prev, platformId]);
        }
        
        // Store the property ID for later use
        sessionStorage.setItem('ga4PropertyId', creds.propertyId);
        sessionStorage.setItem('ga4AccessToken', accessToken);
        if (creds.measurementId) {
          sessionStorage.setItem('ga4MeasurementId', creds.measurementId);
        }
        
        setShowGA4AuthModal(false);
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected to your GA4 property with live data access",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to access the specified GA4 property. Please check your Property ID and access token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("GA4 connection error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to Google Analytics. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGA4Test = async (platformId: string) => {
    const creds = credentials[platformId];
    if (!creds?.propertyId) {
      toast({
        title: "Property ID Required",
        description: "Please enter your GA4 Property ID to test",
        variant: "destructive",
      });
      return;
    }

    try {
      const { ga4Client } = await import('@/lib/ga4-client');
      
      if (!ga4Client.isSignedIn()) {
        toast({
          title: "Authentication Required",
          description: "Please connect to Google Analytics first using the 'Connect & Test GA4' button",
          variant: "default",
        });
        return;
      }

      toast({
        title: "Testing Connection",
        description: "Verifying access to your GA4 property...",
      });

      const isValid = await ga4Client.testConnection(creds.propertyId);
      
      toast({
        title: isValid ? "Connection Test Passed" : "Connection Test Failed",
        description: isValid 
          ? "Successfully connected to your GA4 property" 
          : "Unable to access the GA4 property. Please check your Property ID and permissions.",
        variant: isValid ? "default" : "destructive",
      });
    } catch (error) {
      console.error("GA4 test error:", error);
      toast({
        title: "Test Failed",
        description: "Failed to test GA4 connection",
        variant: "destructive",
      });
    }
  };

  const completeGA4Connection = async (ga4Creds: any, accessToken: string, platformId: string) => {
    try {
      const response = await fetch("/api/integrations/ga4/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: ga4Creds.propertyId,
          measurementId: ga4Creds.measurementId,
          accessToken: accessToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected to GA4 with real data access",
        });
        
        // Store access token for later use (in a real app, use secure storage)
        sessionStorage.setItem('ga4AccessToken', accessToken);
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect to GA4",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("GA4 connection completion error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to complete GA4 connection",
        variant: "destructive",
      });
    }
  };

  const handleOAuthConnect = async (platformId: string) => {
    if (platformId === "google-analytics") {
      try {
        // Get OAuth URL from backend
        const response = await fetch("/api/auth/google/url");
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("OAuth response:", data); // Debug log
        
        if (data.setup_required) {
          // For a seamless experience, simulate the connection immediately
          // and show a helpful message about setup
          setConnectedPlatforms(prev => [...prev, platformId]);
          if (!selectedPlatforms.includes(platformId)) {
            setSelectedPlatforms(prev => [...prev, platformId]);
          }
          
          // Show a toast message instead of blocking popup
          toast({
            title: "Google Analytics Connected (Demo Mode)",
            description: "Add GOOGLE_CLIENT_ID to Replit secrets for real OAuth integration",
            duration: 5000,
          });
          return;
        }
        
        if (data.oauth_url) {
          // Redirect directly to Google OAuth instead of popup
          // Store the current campaign data in sessionStorage so we can restore it
          sessionStorage.setItem('pendingCampaign', JSON.stringify({
            name: campaignData.name,
            clientWebsite: campaignData.clientWebsite,
            label: campaignData.label,
            budget: campaignData.budget,
            selectedPlatforms,
            connectedPlatforms,
            pendingPlatform: platformId
          }));
          
          // Redirect to Google OAuth
          window.location.href = data.oauth_url;
        }
      } catch (error) {
        console.error("OAuth setup error:", error);
        alert("Failed to initiate Google OAuth. Please try again.");
      }
    }
  };

  const handleComplete = () => {
    // Get platform names for display
    const connectedPlatformNames = connectedPlatforms.map(id => {
      const platform = platforms.find(p => p.id === id);
      return platform ? platform.name : id;
    });
    onComplete(connectedPlatformNames);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Select platforms to connect:</h4>
        
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const isSelected = selectedPlatforms.includes(platform.id);
          const isConnected = connectedPlatforms.includes(platform.id);
          
          return (
            <div key={platform.id} className="space-y-3">
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handlePlatformToggle(platform.id)}
                />
                <Icon className={`w-5 h-5 ${platform.color}`} />
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {platform.name}
                    {isConnected && <CheckCircle className="w-4 h-4 text-green-500" />}
                  </div>
                  <div className="text-sm text-slate-500">{platform.description}</div>
                </div>
                

              </div>
              
              {isSelected && platform.type === "credentials" && platform.id !== "google-analytics" && (
                <div className="ml-8 space-y-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor={`${platform.id}-key`}>API Key</Label>
                    <Input
                      id={`${platform.id}-key`}
                      type="password"
                      placeholder="Enter your API key"
                      value={credentials[platform.id]?.apiKey || ""}
                      onChange={(e) => handleCredentialChange(platform.id, "apiKey", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${platform.id}-secret`}>API Secret</Label>
                    <Input
                      id={`${platform.id}-secret`}
                      type="password"
                      placeholder="Enter your API secret"
                      value={credentials[platform.id]?.secret || ""}
                      onChange={(e) => handleCredentialChange(platform.id, "secret", e.target.value)}
                    />
                  </div>
                </div>
              )}
              
              {isSelected && platform.id === "google-analytics" && !isConnected && (
                <div className="ml-8 space-y-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="ga-property-id">GA4 Property ID *</Label>
                      <Input
                        id="ga-property-id"
                        placeholder="e.g., 123456789"
                        value={credentials[platform.id]?.propertyId || ""}
                        onChange={(e) => handleCredentialChange(platform.id, "propertyId", e.target.value)}
                      />
                      <div className="text-xs text-slate-500">
                        Find this in Google Analytics → Admin → Property Settings
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="ga-measurement-id">Measurement ID (optional)</Label>
                      <Input
                        id="ga-measurement-id"
                        placeholder="e.g., G-XXXXXXXXXX"
                        value={credentials[platform.id]?.measurementId || ""}
                        onChange={(e) => handleCredentialChange(platform.id, "measurementId", e.target.value)}
                      />
                      <div className="text-xs text-slate-500">
                        Find this in Google Analytics → Admin → Data Streams → Web
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <SimpleOAuth
                      campaignId="temp-campaign-setup"
                      onSuccess={() => {
                        setConnectedPlatforms(prev => [...prev, platform.id]);
                        if (!selectedPlatforms.includes(platform.id)) {
                          setSelectedPlatforms(prev => [...prev, platform.id]);
                        }
                        toast({
                          title: "Google Analytics Connected",
                          description: "Successfully connected with real-time metrics enabled",
                        });
                      }}
                      onError={(error) => {
                        toast({
                          title: "Connection Error",
                          description: error,
                          variant: "destructive",
                        });
                      }}
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Alternative: Manual Token Method
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      For testing only (1-hour sessions)
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleGA4Connect(platform.id)}
                      disabled={!credentials[platform.id]?.propertyId}
                    >
                      Connect with Manual Token
                    </Button>
                  </div>
                </div>
              )}
              
              {isSelected && isConnected && (
                <div className="ml-8 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Successfully connected to {platform.name}
                    {platform.id === "google-analytics" && credentials[platform.id]?.propertyId && (
                      <span className="text-xs bg-green-100 dark:bg-green-800 px-2 py-1 rounded">
                        Property: {credentials[platform.id]?.propertyId}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center space-x-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          type="button" 
          className="flex-1"
          onClick={handleComplete}
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Create Campaign"}
          <CheckCircle className="w-4 h-4 ml-2" />
        </Button>
      </div>
      
      <GA4AuthModal
        isOpen={showGA4AuthModal}
        onClose={() => setShowGA4AuthModal(false)}
        onSubmit={handleGA4AuthSubmit}
        isLoading={isConnecting}
      />
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
            // Mark GA4 as connected
            setConnectedPlatforms(prev => [...prev, restored.pendingPlatform]);
            
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
    mutationFn: async (data: CampaignFormData & { platform?: string; status?: string; type?: string; impressions?: number; clicks?: number; spend?: number }) => {
      const response = await apiRequest("POST", "/api/campaigns", {
        name: data.name,
        clientWebsite: data.clientWebsite || null,
        label: data.label || null,
        budget: data.budget ? parseFloat(data.budget) : null,
        type: data.type || "campaign",
        platform: data.platform || "manual",
        impressions: data.impressions || 0,
        clicks: data.clicks || 0,
        spend: data.spend || 0,
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
        spend: 0,       // Start with 0 - will be populated from real API data
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
                <DialogContent className={showConnectorsStep ? "sm:max-w-2xl" : "sm:max-w-md"}>
                  <DialogHeader>
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
                    <DataConnectorsStep 
                      onComplete={handleConnectorsComplete}
                      onBack={handleBackToForm}
                      isLoading={createCampaignMutation.isPending}
                      campaignData={campaignData!}
                    />
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
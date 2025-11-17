import { useState, useEffect, type FocusEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Play, Pause, Edit, Trash2, BarChart3, DollarSign, Target, Eye, ArrowLeft, CheckCircle, ChevronDown, ExternalLink, Shield, Upload, Mail } from "lucide-react";
import { SiFacebook, SiGoogle, SiLinkedin, SiX } from "react-icons/si";
import { Campaign, insertCampaignSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IntegratedGA4Auth } from "@/components/IntegratedGA4Auth";
import { SimpleGoogleSheetsAuth } from "@/components/SimpleGoogleSheetsAuth";
import { LinkedInConnectionFlow } from "@/components/LinkedInConnectionFlow";
import { SimpleMetaAuth } from "@/components/SimpleMetaAuth";

const campaignFormSchema = insertCampaignSchema.extend({
  name: z.string().min(1, "Campaign name is required"),
  clientWebsite: z.string().optional(),
  label: z.string().optional(),
  budget: z.string().optional(),
  currency: z.string().optional(),
  startDate: z.union([z.string(), z.date(), z.null()]).transform((val) => {
    if (!val || val === null) return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
      const date = new Date(trimmed);
      if (Number.isNaN(date.getTime())) return undefined;
      return date;
    }
    return val;
  }).optional(),
  endDate: z.union([z.string(), z.date(), z.null()]).transform((val) => {
    if (!val || val === null) return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
      const date = new Date(trimmed);
      if (Number.isNaN(date.getTime())) return undefined;
      return date;
    }
    return val;
  }).optional(),
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
  onLinkedInImportComplete?: () => void;
  onPlatformsChange?: (platforms: string[]) => void;
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
    id: "google-sheets",
    name: "Google Sheets",
    icon: SiGoogle,
    color: "text-green-500",
    description: "Connect Google Sheets for data import/export",
    type: "credentials"
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

function DataConnectorsStep({ onComplete, onBack, isLoading, campaignData, onLinkedInImportComplete, onPlatformsChange }: DataConnectorsStepProps & { campaignData: CampaignFormData }) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});
  const [ga4Properties, setGA4Properties] = useState<Array<{ id: string; name: string; account?: string }>>([]);
  const [selectedGA4Property, setSelectedGA4Property] = useState<string>('');
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const [isGA4PropertyLoading, setIsGA4PropertyLoading] = useState(false);
  const [showCustomIntegrationModal, setShowCustomIntegrationModal] = useState(false);
  const [customIntegrationEmail, setCustomIntegrationEmail] = useState('');
  const [allowedEmailAddresses, setAllowedEmailAddresses] = useState('');
  const [showEmailForwardingInstructions, setShowEmailForwardingInstructions] = useState(false);
  const [customIntegrationWebhookUrl, setCustomIntegrationWebhookUrl] = useState('');
  const { toast } = useToast();

  // Notify parent whenever connected platforms change
  useEffect(() => {
    console.log('📊 DataConnectorsStep - connectedPlatforms changed:', connectedPlatforms);
    if (onPlatformsChange) {
      console.log('📊 Calling onPlatformsChange with:', connectedPlatforms);
      onPlatformsChange(connectedPlatforms);
    }
  }, [connectedPlatforms]); // Remove onPlatformsChange from deps to avoid stale closure issues

  const handlePlatformClick = (platformId: string) => {
    if (connectedPlatforms.includes(platformId)) {
      // Already connected, just toggle selection
      setSelectedPlatforms(prev => 
        prev.includes(platformId) 
          ? prev.filter(id => id !== platformId)
          : [...prev, platformId]
      );
    } else {
      // Toggle expansion to show credential inputs
      setExpandedPlatforms(prev => ({
        ...prev,
        [platformId]: !prev[platformId]
      }));
    }
  };

  const handlePlatformConnect = async (platformId: string) => {
    // Start connection process
    if (platformId === 'google-analytics') {
      await loadGA4Properties();
    } else if (platformId === 'google-sheets') {
      // Google Sheets connection is handled by the component
      // Mark as connected when the component succeeds
      setConnectedPlatforms(prev => [...prev, platformId]);
      setSelectedPlatforms(prev => [...prev, platformId]);
      setExpandedPlatforms(prev => ({ ...prev, [platformId]: false }));
    } else {
      // For other platforms, show coming soon message
      toast({
        title: "Coming Soon",
        description: `${platforms.find(p => p.id === platformId)?.name} integration will be available soon.`,
      });
    }
  };



  const loadGA4Properties = async () => {
    setIsGA4PropertyLoading(true);
    setIsConnecting(prev => ({ ...prev, 'google-analytics': true }));

    try {
      const response = await fetch(`/api/campaigns/temp-campaign-setup/ga4-connection-status`);
      const data = await response.json();

      if (data.connected && Array.isArray(data.properties) && data.properties.length > 0) {
        setGA4Properties(data.properties);
        setSelectedGA4Property(data.properties[0]?.id || '');
        setShowPropertySelector(true);
        toast({
          title: "Google Account Connected",
          description: "Select the GA4 property you want to use for this campaign."
        });
      } else if (data.connected && data.propertyId) {
        setConnectedPlatforms(prev => [...prev, 'google-analytics']);
        setSelectedPlatforms(prev => [...prev, 'google-analytics']);
        setExpandedPlatforms(prev => ({ ...prev, 'google-analytics': false }));
        toast({
          title: "GA4 Connected",
          description: "Your Google Analytics property is already linked."
        });
      } else {
        toast({
          title: "Connection Pending",
          description: "We couldn't fetch your GA4 properties. Please try connecting again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('GA4 property load error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to retrieve Google Analytics properties. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(prev => ({ ...prev, 'google-analytics': false }));
      setIsGA4PropertyLoading(false);
    }
  };

  const handleCustomIntegrationConnect = async () => {
    setIsConnecting(prev => ({ ...prev, 'custom-integration': true }));
    
    try {
      // Parse allowed email addresses (comma-separated or newline-separated)
      const emailList = allowedEmailAddresses
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(e => e.length > 0);
      
      const response = await fetch('/api/custom-integration/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: 'temp-campaign-setup',
          email: 'webhook@custom-integration.local', // Placeholder email
          allowedEmailAddresses: emailList.length > 0 ? emailList : undefined
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConnectedPlatforms(prev => [...prev, 'custom-integration']);
        setSelectedPlatforms(prev => [...prev, 'custom-integration']);
        setShowCustomIntegrationModal(false);
        setCustomIntegrationEmail('');
        setAllowedEmailAddresses('');
        
        const securityMsg = emailList.length > 0 
          ? ` Only emails from ${emailList.length} whitelisted address${emailList.length !== 1 ? 'es' : ''} will be accepted.`
          : '';
        
        toast({
          title: "Custom Integration Connected!",
          description: `Successfully connected.${securityMsg}`
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect with provided email.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Custom integration connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(prev => ({ ...prev, 'custom-integration': false }));
    }
  };

  const handlePropertySelection = async () => {
    if (!selectedGA4Property) {
      toast({
        title: "Property Required",
        description: "Please select a GA4 property to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsGA4PropertyLoading(true);

    try {
      const response = await fetch(`/api/campaigns/temp-campaign-setup/ga4-property`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedGA4Property
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectedPlatforms(prev => [...prev, 'google-analytics']);
        setSelectedPlatforms(prev => [...prev, 'google-analytics']);
        setExpandedPlatforms(prev => ({ ...prev, 'google-analytics': false }));
        setShowPropertySelector(false);
        toast({
          title: "GA4 Connected!",
          description: "Google Analytics is now linked to this campaign."
        });
      } else {
        throw new Error(data?.message || data?.error || "Failed to connect property");
      }
    } catch (error) {
      console.error('Property selection error:', error);
      toast({
        title: "Selection Failed",
        description: "Failed to connect to the selected property.",
        variant: "destructive"
      });
    } finally {
      setIsGA4PropertyLoading(false);
    }
  };



  const handleComplete = () => {
    // Pass platform IDs directly - don't convert to names
    onComplete(selectedPlatforms);
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
          const isExpanded = expandedPlatforms[platform.id];
          const platformConnecting = isConnecting[platform.id] || false;
          
          return (
            <div key={platform.id} className="border rounded-lg overflow-hidden">
              {/* Platform Header - Always Visible */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => handlePlatformClick(platform.id)}
              >
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
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPlatforms(prev => [...prev, platform.id]);
                        } else {
                          setSelectedPlatforms(prev => prev.filter(id => id !== platform.id));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  
                  {!isConnected && (
                    <div className="flex items-center gap-2">
                      {isExpanded && platformConnecting && (
                        <span className="text-sm text-slate-500">Connecting...</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Credential Input Section - Only show when expanded and not connected */}
              {isExpanded && !isConnected && (
                <div className="border-t bg-slate-50 dark:bg-slate-800/50 p-4">
                  {platform.id === 'google-analytics' && (
                    <IntegratedGA4Auth
                      campaignId="temp-campaign-setup"
                      onSuccess={() => {
                        void loadGA4Properties();
                      }}
                      onError={(error) => {
                        toast({
                          title: "Connection Failed",
                          description: error || "Unable to complete Google Analytics connection.",
                          variant: "destructive"
                        });
                      }}
                    />
                  )}
                  
                  {platform.id === 'google-sheets' && (
                    <SimpleGoogleSheetsAuth
                      campaignId="temp-campaign-setup"
                      onSuccess={() => {
                        setConnectedPlatforms(prev => [...prev, 'google-sheets']);
                        setSelectedPlatforms(prev => [...prev, 'google-sheets']);
                        setExpandedPlatforms(prev => ({ ...prev, 'google-sheets': false }));
                        toast({
                          title: "Google Sheets Connected!",
                          description: "Successfully connected to your spreadsheet data."
                        });
                      }}
                      onError={(error) => {
                        toast({
                          title: "Connection Failed",
                          description: error,
                          variant: "destructive"
                        });
                      }}
                    />
                  )}
                  
                  {platform.id === 'linkedin' && (
                    <LinkedInConnectionFlow
                      campaignId="temp-campaign-setup"
                      mode="new"
                      onConnectionSuccess={() => {
                        console.log('🔗 LinkedIn onConnectionSuccess fired!');
                        setConnectedPlatforms(prev => {
                          const updated = [...prev, 'linkedin'];
                          console.log('🔗 Updated connectedPlatforms to:', updated);
                          // Also update parent immediately
                          if (onPlatformsChange) {
                            console.log('🔗 Immediately updating parent with:', updated);
                            onPlatformsChange(updated);
                          }
                          return updated;
                        });
                        setSelectedPlatforms(prev => [...prev, 'linkedin']);
                        setExpandedPlatforms(prev => ({ ...prev, 'linkedin': false }));
                        toast({
                          title: "LinkedIn Ads Connected!",
                          description: "Successfully connected to your LinkedIn ad account."
                        });
                      }}
                      onImportComplete={() => {
                        if (onLinkedInImportComplete) {
                          onLinkedInImportComplete();
                        }
                      }}
                    />
                  )}
                  
                  {platform.id === 'facebook' && (
                    <SimpleMetaAuth
                      campaignId="temp-campaign-setup"
                      onSuccess={() => {
                        setConnectedPlatforms(prev => [...prev, 'facebook']);
                        setSelectedPlatforms(prev => [...prev, 'facebook']);
                        setExpandedPlatforms(prev => ({ ...prev, 'facebook': false }));
                        toast({
                          title: "Meta/Facebook Ads Connected!",
                          description: "Successfully connected to your Meta ad account."
                        });
                      }}
                      onError={(error) => {
                        toast({
                          title: "Connection Failed",
                          description: error,
                          variant: "destructive"
                        });
                      }}
                    />
                  )}
                  
                  {!['google-analytics', 'google-sheets', 'linkedin', 'facebook'].includes(platform.id) && (
                    <div className="text-center py-6">
                      <div className="text-slate-600 dark:text-slate-400 mb-3">
                        {platform.name} integration coming soon
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast({
                            title: "Coming Soon",
                            description: `${platform.name} integration will be available soon.`,
                          });
                        }}
                      >
                        Notify Me
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Custom Integration Link */}
        <div 
          className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-all"
          onClick={() => setShowCustomIntegrationModal(true)}
          data-testid="button-custom-integration"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Custom Integration</div>
                <div className="text-sm text-slate-500">Connect your own data source or API</div>
              </div>
            </div>
            {connectedPlatforms.includes('custom-integration') && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
          </div>
        </div>
      </div>
      
      {/* Custom Integration Modal */}
      <Dialog open={showCustomIntegrationModal} onOpenChange={setShowCustomIntegrationModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Custom Integration</DialogTitle>
            <DialogDescription>
              Import metrics from PDF reports into your dashboard
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <button
                onClick={async () => {
                  // Create file input for PDF upload
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    
                    try {
                      setIsConnecting(prev => ({ ...prev, 'custom-integration': true }));
                      
                      // First, create the custom integration connection
                      const connectResponse = await fetch(`/api/custom-integration/temp-campaign-setup/connect`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          allowedEmailAddresses: []
                        })
                      });
                      
                      if (!connectResponse.ok) {
                        throw new Error('Failed to create custom integration');
                      }
                      
                      // Upload the PDF
                      const formData = new FormData();
                      formData.append('pdf', file);
                      
                      const uploadResponse = await fetch(`/api/custom-integration/temp-campaign-setup/upload-pdf`, {
                        method: 'POST',
                        body: formData
                      });
                      
                      if (!uploadResponse.ok) {
                        throw new Error('Failed to upload PDF');
                      }
                      
                      const result = await uploadResponse.json();
                      
                      // Mark as connected
                      setConnectedPlatforms(prev => [...prev, 'custom-integration']);
                      setSelectedPlatforms(prev => [...prev, 'custom-integration']);
                      setShowCustomIntegrationModal(false);
                      
                      toast({
                        title: "PDF Uploaded Successfully!",
                        description: result._confidence 
                          ? `Metrics extracted with ${result._confidence}% confidence`
                          : "Metrics extracted successfully"
                      });
                      
                    } catch (error: any) {
                      console.error('PDF upload error:', error);
                      toast({
                        title: "Upload Failed",
                        description: error.message || "Failed to upload PDF",
                        variant: "destructive"
                      });
                    } finally {
                      setIsConnecting(prev => ({ ...prev, 'custom-integration': false }));
                    }
                  };
                  input.click();
                }}
                className="w-full bg-white dark:bg-slate-800 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold flex-shrink-0 group-hover:bg-blue-700 transition-colors">
                    1
                  </span>
                  <div className="flex-1">
                    <h5 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Manual Upload (Recommended)
                    </h5>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Upload a PDF report now. Metrics will be extracted and ready to use immediately. Takes 30 seconds.
                    </p>
                  </div>
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
                </div>
              </button>
              
              <button
                onClick={async () => {
                  try {
                    setIsConnecting(prev => ({ ...prev, 'custom-integration': true }));
                    
                    const response = await fetch(`/api/custom-integration/temp-campaign-setup/connect`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        allowedEmailAddresses: allowedEmailAddresses.split(/[\n,]/).map(e => e.trim()).filter(Boolean)
                      })
                    });
                    
                    if (!response.ok) {
                      throw new Error('Failed to create custom integration');
                    }
                    
                    const data = await response.json();
                    
                    setConnectedPlatforms(prev => [...prev, 'custom-integration']);
                    setSelectedPlatforms(prev => [...prev, 'custom-integration']);
                    setShowCustomIntegrationModal(false);
                    setShowEmailForwardingInstructions(true);
                    setCustomIntegrationEmail(data.campaignEmail || 'temp-campaign-setup@import.mforensics.com');
                    
                    toast({
                      title: "Email Forwarding Configured!",
                      description: "Forward PDFs to your unique email address."
                    });
                    
                  } catch (error: any) {
                    console.error('Custom integration connection error:', error);
                    toast({
                      title: "Connection Failed",
                      description: error.message || "Failed to connect custom integration",
                      variant: "destructive"
                    });
                  } finally {
                    setIsConnecting(prev => ({ ...prev, 'custom-integration': false }));
                  }
                }}
                disabled={isConnecting['custom-integration']}
                className="w-full bg-white dark:bg-slate-800 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-600 text-white text-sm font-semibold flex-shrink-0 group-hover:bg-blue-700 transition-colors">
                    2
                  </span>
                  <div className="flex-1">
                    <h5 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Email Forwarding (Advanced)
                    </h5>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Set up automatic import via email forwarding. Requires one-time CloudMailin configuration.
                    </p>
                  </div>
                  <Mail className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
                </div>
              </button>
            </div>

            {/* Email whitelist section - only show for email forwarding option */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Email Whitelist (Optional - For Email Forwarding Only)
              </label>
              <textarea
                placeholder="Leave empty to accept from any email&#10;&#10;Or enter allowed sender addresses:&#10;reports@provider.com&#10;analytics@company.com"
                value={allowedEmailAddresses}
                onChange={(e) => setAllowedEmailAddresses(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                data-testid="input-email-whitelist"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restricts which email addresses can send reports to your webhook. Only applies to email forwarding option.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCustomIntegrationModal(false);
                  setCustomIntegrationEmail('');
                  setAllowedEmailAddresses('');
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Forwarding Instructions Modal */}
      <Dialog open={showEmailForwardingInstructions} onOpenChange={setShowEmailForwardingInstructions}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Email Forwarding Configured!
            </DialogTitle>
            <DialogDescription>
              Your unique email address has been generated
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Email Address Display */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                Forward PDF reports to:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-mono text-sm break-all">
                  {customIntegrationEmail}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(customIntegrationEmail);
                    toast({
                      title: "Copied!",
                      description: "Email address copied to clipboard"
                    });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            
            {/* How it Works */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4" />
                How it works:
              </h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Forward any email with PDF attachments to this address</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>PDFs are automatically parsed and imported</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Metrics appear in your dashboard within minutes</span>
                </li>
              </ul>
            </div>
            
            {/* Tip */}
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-900 dark:text-amber-100 flex items-start gap-2">
                <span className="text-lg">💡</span>
                <span>
                  <strong>Tip:</strong> Add this email to your contacts for easy forwarding
                </span>
              </p>
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={() => setShowEmailForwardingInstructions(false)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Got it!
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Buttons removed - now handled by parent component for better UX */}
      
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
              <div className="space-y-2">
                <Label htmlFor="ga4-property-select">GA4 Property</Label>
                <Select
                  value={selectedGA4Property}
                  onValueChange={(value) => setSelectedGA4Property(value)}
                >
                  <SelectTrigger id="ga4-property-select" className="w-full">
                    <SelectValue placeholder="Select a GA4 property" />
                  </SelectTrigger>
                  <SelectContent>
                    {ga4Properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        <div className="flex flex-col text-left">
                          <span className="font-medium">{property.name}</span>
                          {property.account && (
                            <span className="text-xs text-muted-foreground">
                              Account: {property.account}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            ID: {property.id}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  disabled={!selectedGA4Property || isGA4PropertyLoading}
                  className="flex-1"
                >
                  {isGA4PropertyLoading ? "Connecting..." : "Connect Property"}
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
  const [, setLocation] = useLocation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showConnectorsStep, setShowConnectorsStep] = useState(false);
  const [campaignData, setCampaignData] = useState<CampaignFormData | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [linkedInImportComplete, setLinkedInImportComplete] = useState(false);
  const [connectedPlatformsInDialog, setConnectedPlatformsInDialog] = useState<string[]>([]);
  
  // Debug: log whenever connectedPlatformsInDialog changes
  useEffect(() => {
    console.log('🎯 connectedPlatformsInDialog updated:', connectedPlatformsInDialog);
  }, [connectedPlatformsInDialog]);
  const { toast } = useToast();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });


  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      clientWebsite: "",
      label: "",
      budget: "",
    },
  });

  const editForm = useForm<CampaignFormData>({
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
      console.log('🚀 [Frontend] Creating campaign with data:', data);
      const payload = {
        name: data.name,
        clientWebsite: data.clientWebsite || null,
        label: data.label || null,
        budget: data.budget ? parseFloat(data.budget) : null,
        currency: data.currency || "USD",
        conversionValue: data.conversionValue ? parseFloat(data.conversionValue as any) : null,
        type: data.type || "campaign",
        platform: data.platform || "manual",
        impressions: data.impressions || 0,
        clicks: data.clicks || 0,
        spend: data.spend || "0",
        status: data.status || "active",
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      };
      console.log('🚀 [Frontend] API payload:', payload);
      const response = await apiRequest("POST", "/api/campaigns", payload);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [Frontend] API error response:', errorData);
        throw new Error(errorData.message || 'Failed to create campaign');
      }
      const result = await response.json();
      console.log('✅ [Frontend] Campaign created:', result);
      return result;
    },
    onSuccess: async (newCampaign) => {
      console.log('✅ [Frontend] Campaign creation success callback:', newCampaign);
      // Only invalidate queries here
      // Dialog closing and navigation happen in handleConnectorsComplete after transfers
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (error: any) => {
      console.error('❌ [Frontend] Campaign creation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<CampaignFormData>) => {
      const response = await apiRequest("PATCH", `/api/campaigns/${data.id}`, {
        name: data.name,
        clientWebsite: data.clientWebsite || null,
        label: data.label || null,
        budget: data.budget || null,
        currency: data.currency || "USD",
        conversionValue: data.conversionValue || null, // Added conversion value
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", variables.id] });
      toast({
        title: "Campaign updated",
        description: "Campaign has been updated successfully.",
      });
      setEditingCampaign(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleCampaignStatusMutation = useMutation({
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

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/campaigns/${id}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to delete campaign");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campaign deleted",
        description: "Campaign has been permanently deleted.",
      });
    },
    onError: (error: any) => {
      console.error("Delete campaign error:", error);
      toast({
        title: "Error", 
        description: error.message || "Failed to delete campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CampaignFormData) => {
    setCampaignData(data);
    setShowConnectorsStep(true);
  };

  const handleConnectorsComplete = async (selectedPlatforms: string[]) => {
    if (campaignData) {
      console.log('🚀 handleConnectorsComplete called with platforms:', selectedPlatforms);
      console.log('🚀 Current connectedPlatformsInDialog:', connectedPlatformsInDialog);
      
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
      
      console.log('🔧 Creating campaign with platforms:', selectedPlatforms);
      
      // Create the campaign and wait for response
      const newCampaign = await new Promise((resolve, reject) => {
        createCampaignMutation.mutate(campaignWithPlatforms, {
          onSuccess: (data) => {
            console.log('✅ Campaign created:', data);
            resolve(data);
          },
          onError: reject
        });
      });
      
      // Debug: Log selected platforms for troubleshooting
      console.log('🔧 Debug - Selected platforms for transfer:', selectedPlatforms);
      
      // Transfer GA4 connection if GA4 was connected
      if (selectedPlatforms.includes('google-analytics')) {
        try {
          console.log('🔄 Starting GA4 connection transfer...');
          const response = await fetch('/api/ga4/transfer-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromCampaignId: 'temp-campaign-setup',
              toCampaignId: (newCampaign as any).id
            })
          });
          const result = await response.json();
          if (result.success) {
            console.log('✅ GA4 connection transferred successfully to campaign:', (newCampaign as any).id);
            // Invalidate and refetch connection status queries
            await queryClient.invalidateQueries({ queryKey: ["/api/ga4/check-connection", (newCampaign as any).id] });
            await queryClient.refetchQueries({ queryKey: ["/api/ga4/check-connection", (newCampaign as any).id] });
          } else {
            console.error('❌ GA4 transfer failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Failed to transfer GA4 connection:', error);
        }
      }

      // Transfer Google Sheets connection if Google Sheets was connected
      if (selectedPlatforms.includes('google-sheets')) {
        console.log('🔧 Attempting Google Sheets transfer...');
        try {
          const response = await fetch('/api/google-sheets/transfer-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromCampaignId: 'temp-campaign-setup',
              toCampaignId: (newCampaign as any).id
            })
          });
          const result = await response.json();
          if (result.success) {
            console.log('✅ Google Sheets connection transferred successfully to campaign:', (newCampaign as any).id);
          } else {
            console.error('❌ Google Sheets transfer failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Failed to transfer Google Sheets connection:', error);
        }
      } else {
        console.log('🔧 Google Sheets not in selected platforms, skipping transfer');
      }

      // Transfer LinkedIn connection if LinkedIn was connected
      if (selectedPlatforms.includes('linkedin')) {
        console.log('🔧 Attempting LinkedIn transfer...');
        try {
          const response = await fetch('/api/linkedin/transfer-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromCampaignId: 'temp-campaign-setup',
              toCampaignId: (newCampaign as any).id
            })
          });
          const result = await response.json();
          if (result.success) {
            console.log('✅ LinkedIn connection transferred successfully to campaign:', (newCampaign as any).id);
          } else {
            console.error('❌ LinkedIn transfer failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Failed to transfer LinkedIn connection:', error);
        }
      } else {
        console.log('🔧 LinkedIn not in selected platforms, skipping transfer');
      }

      // Transfer Meta connection if Meta was connected
      if (selectedPlatforms.includes('facebook')) {
        console.log('🔧 Attempting Meta transfer...');
        try {
          const response = await fetch('/api/meta/transfer-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromCampaignId: 'temp-campaign-setup',
              toCampaignId: (newCampaign as any).id
            })
          });
          const result = await response.json();
          if (result.success) {
            console.log('✅ Meta connection transferred successfully to campaign:', (newCampaign as any).id);
          } else {
            console.error('❌ Meta transfer failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Failed to transfer Meta connection:', error);
        }
      } else {
        console.log('🔧 Meta not in selected platforms, skipping transfer');
      }

      // Transfer Custom Integration if custom integration was connected
      if (selectedPlatforms.includes('custom-integration')) {
        console.log('🔧 Attempting Custom Integration transfer...');
        try {
          const response = await fetch('/api/custom-integration/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromCampaignId: 'temp-campaign-setup',
              toCampaignId: (newCampaign as any).id
            })
          });
          const result = await response.json();
          if (result.success) {
            console.log('✅ Custom Integration transferred successfully to campaign:', (newCampaign as any).id);
            // Remove query cache entirely to ensure fresh data on next fetch
            queryClient.removeQueries({ queryKey: ["/api/custom-integration", (newCampaign as any).id] });
            queryClient.removeQueries({ queryKey: ["/api/campaigns", (newCampaign as any).id, "connected-platforms"] });
            console.log('✅ Removed query cache for Custom Integration and connected platforms - will fetch fresh on next mount');
          } else {
            console.error('❌ Custom Integration transfer failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Failed to transfer Custom Integration:', error);
        }
      } else {
        console.log('🔧 Custom Integration not in selected platforms, skipping transfer');
      }

      // All transfers complete - now clean up and navigate
      toast({
        title: "Campaign created",
        description: "Your new campaign has been created successfully.",
      });
      
      setIsCreateModalOpen(false);
      setShowConnectorsStep(false);
      setCampaignData(null);
      setLinkedInImportComplete(false);
      setConnectedPlatformsInDialog([]);
      form.reset();
      
      // Navigate to campaigns page after all transfers complete
      setLocation("/campaigns");
    }
  };

  const handleBackToForm = () => {
    setShowConnectorsStep(false);
    setLinkedInImportComplete(false);
  };

  const toggleCampaignStatus = (campaign: Campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    toggleCampaignStatusMutation.mutate({
      id: campaign.id,
      data: { status: newStatus }
    });
  };

  const handleEditSubmit = (data: CampaignFormData) => {
    if (editingCampaign) {
      // Remove commas from budget before sending to backend
      const cleanedData = {
        ...data,
        budget: data.budget ? data.budget.replace(/,/g, '') : data.budget,
      };
      
      updateCampaignMutation.mutate({
        id: editingCampaign.id,
        ...cleanedData,
      });
    }
  };

  // Update edit form when editing campaign changes
  useEffect(() => {
    if (editingCampaign) {
      // Format budget with commas for display
      let formattedBudget = "";
      if (editingCampaign.budget) {
        const budgetStr = editingCampaign.budget.toString();
        const parts = budgetStr.split('.');
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        formattedBudget = parts[1] !== undefined 
          ? `${integerPart}.${parts[1].padEnd(2, '0').slice(0, 2)}`
          : `${integerPart}.00`;
      }
      
      const startDateValue = editingCampaign.startDate 
        ? (editingCampaign.startDate instanceof Date 
            ? editingCampaign.startDate.toISOString().slice(0, 10)
            : new Date(editingCampaign.startDate).toISOString().slice(0, 10))
        : "";

      const endDateValue = editingCampaign.endDate 
        ? (editingCampaign.endDate instanceof Date 
            ? editingCampaign.endDate.toISOString().slice(0, 10)
            : new Date(editingCampaign.endDate).toISOString().slice(0, 10))
        : "";

      editForm.reset({
        name: editingCampaign.name,
        clientWebsite: editingCampaign.clientWebsite || "",
        label: editingCampaign.label || "",
        budget: formattedBudget,
        currency: editingCampaign.currency || "USD",
        conversionValue: editingCampaign.conversionValue?.toString() || "",
        startDate: startDateValue,
        endDate: endDateValue,
      } as any);
    }
  }, [editingCampaign, editForm]);

  const deleteCampaign = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
  };

  const confirmDelete = () => {
    if (campaignToDelete) {
      deleteCampaignMutation.mutate(campaignToDelete.id);
      setCampaignToDelete(null);
    }
  };

  const formatCurrency = (value: string | null, currency: string = 'USD') => {
    if (!value) return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
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

  const resetCreateModalState = () => {
    setShowConnectorsStep(false);
    setLinkedInImportComplete(false);
    setConnectedPlatformsInDialog([]);
    setCampaignData(null);
    form.reset();
  };

  const handleCreateModalChange = (open: boolean) => {
    setIsCreateModalOpen(open);
    resetCreateModalState();
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
              
              <Dialog open={isCreateModalOpen} onOpenChange={handleCreateModalChange}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className={`${showConnectorsStep ? "sm:max-w-4xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto pr-12`}>
                  <DialogHeader className="sticky top-0 bg-background z-10 pb-4 pr-8">
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
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="budget">Budget (optional)</Label>
                        {(() => {
                          const budgetRegister = form.register("budget");
                          return (
                            <Input
                              id="budget"
                              {...budgetRegister}
                              onChange={(e) => {
                                budgetRegister.onChange(e);
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                const parts = value.split('.');
                                
                                if (parts[1]?.length > 2) {
                                  const formatted = `${parts[0]}.${parts[1].slice(0, 2)}`;
                                  form.setValue("budget", formatted);
                                  e.target.value = formatted;
                                } else {
                                  form.setValue("budget", value);
                                }
                              }}
                              onBlur={(e) => {
                                budgetRegister.onBlur(e);
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                if (value) {
                                  const parts = value.split('.');
                                  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                  const formatted = parts[1] !== undefined 
                                    ? `${integerPart}.${parts[1].padEnd(2, '0').slice(0, 2)}`
                                    : `${integerPart}.00`;
                                  form.setValue("budget", value);
                                  e.target.value = formatted;
                                }
                              }}
                              onFocus={(e: FocusEvent<HTMLInputElement>) => {
                                const value = e.target.value.replace(/,/g, '');
                                e.target.value = value;
                              }}
                              placeholder="0.00"
                              type="text"
                              inputMode="decimal"
                            />
                          );
                        })()}
                        {form.formState.errors.budget && (
                          <p className="text-sm text-destructive">{form.formState.errors.budget.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select
                          value={form.watch("currency") || "USD"}
                          onValueChange={(value) => form.setValue("currency", value)}
                        >
                          <SelectTrigger id="currency">
                            <SelectValue placeholder="USD" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CAD">CAD</SelectItem>
                            <SelectItem value="AUD">AUD</SelectItem>
                            <SelectItem value="JPY">JPY</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="conversionValue">Conversion Value (optional)</Label>
                        {(() => {
                          const conversionValueRegister = form.register("conversionValue");
                          return (
                            <Input
                              id="conversionValue"
                              {...conversionValueRegister}
                              onChange={(e) => {
                                conversionValueRegister.onChange(e);
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                const parts = value.split('.');
                                
                                if (parts[1]?.length > 2) {
                                  const formatted = `${parts[0]}.${parts[1].slice(0, 2)}`;
                                  form.setValue("conversionValue", formatted);
                                  e.target.value = formatted;
                                } else {
                                  form.setValue("conversionValue", value);
                                }
                              }}
                              onBlur={(e) => {
                                conversionValueRegister.onBlur(e);
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                if (value) {
                                  const parts = value.split('.');
                                  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                  const formatted = parts[1] !== undefined 
                                    ? `${integerPart}.${parts[1].padEnd(2, '0').slice(0, 2)}`
                                    : `${integerPart}.00`;
                                  form.setValue("conversionValue", value);
                                  e.target.value = formatted;
                                }
                              }}
                              onFocus={(e: FocusEvent<HTMLInputElement>) => {
                                const value = e.target.value.replace(/,/g, '');
                                e.target.value = value;
                              }}
                              placeholder="0.00"
                              type="text"
                              inputMode="decimal"
                              min="0"
                            />
                          );
                        })()}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Average revenue per conversion for ROI calculations. You can update this later.
                        </p>
                        {form.formState.errors.conversionValue && (
                          <p className="text-sm text-destructive">{form.formState.errors.conversionValue.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="conversionCurrency">Currency</Label>
                        <Select
                          value={form.watch("currency") || "USD"}
                          onValueChange={(value) => form.setValue("currency", value)}
                        >
                          <SelectTrigger id="conversionCurrency">
                            <SelectValue placeholder="USD" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CAD">CAD</SelectItem>
                            <SelectItem value="AUD">AUD</SelectItem>
                            <SelectItem value="JPY">JPY</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date (optional)</Label>
                        <Input
                          id="startDate"
                          type="date"
                          {...form.register("startDate")}
                        />
                        {form.formState.errors.startDate && (
                          <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date (optional)</Label>
                        <Input
                          id="endDate"
                          type="date"
                          {...form.register("endDate")}
                        />
                        {form.formState.errors.endDate && (
                          <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setIsCreateModalOpen(false);
                          setConnectedPlatformsInDialog([]);
                          setShowConnectorsStep(false);
                          setCampaignData(null);
                          setLinkedInImportComplete(false);
                        }}
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
                          onLinkedInImportComplete={() => setLinkedInImportComplete(true)}
                          onPlatformsChange={setConnectedPlatformsInDialog}
                        />
                      </div>
                      
                      {/* Single unified button for campaign creation */}
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
                            // Use the platforms tracked by DataConnectorsStep
                            console.log('🔧 Creating campaign with platforms:', connectedPlatformsInDialog);
                            handleConnectorsComplete(connectedPlatformsInDialog);
                          }}
                          disabled={createCampaignMutation.isPending}
                        >
                          {createCampaignMutation.isPending ? (
                            <>Creating...</>
                          ) : connectedPlatformsInDialog.length > 0 ? (
                            <>
                              Create Campaign with {connectedPlatformsInDialog.length} platform{connectedPlatformsInDialog.length !== 1 ? 's' : ''}
                              <CheckCircle className="w-4 h-4 ml-2" />
                            </>
                          ) : (
                            <>
                              Create Campaign
                              <CheckCircle className="w-4 h-4 ml-2" />
                            </>
                          )}
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
                        <div className="mb-4">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{campaign.name}</h3>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Budget: {formatCurrency(campaign.budget, campaign.currency)}
                          </div>
                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingCampaign(campaign);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteCampaign(campaign);
                              }}
                              disabled={deleteCampaignMutation.isPending}
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
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!campaignToDelete} onOpenChange={() => setCampaignToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Campaign
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>"{campaignToDelete?.name}"</strong>? This action cannot be undone and will permanently remove all campaign data and analytics connections.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setCampaignToDelete(null)}
              disabled={deleteCampaignMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteCampaignMutation.isPending}
            >
              {deleteCampaignMutation.isPending ? "Deleting..." : "Delete Campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-500" />
              Edit Campaign
            </DialogTitle>
            <DialogDescription>
              Update the campaign details below.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Campaign Name</Label>
              <Input
                id="edit-name"
                {...editForm.register("name")}
                placeholder="Enter campaign name"
                data-testid="input-edit-campaign-name"
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-red-500">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-website">Client Website</Label>
              <Input
                id="edit-website"
                {...editForm.register("clientWebsite")}
                placeholder="https://example.com"
                data-testid="input-edit-client-website"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label/Tag</Label>
              <Input
                id="edit-label"
                {...editForm.register("label")}
                placeholder="e.g., Q1 2024, Brand Awareness"
                data-testid="input-edit-label"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-budget">Budget</Label>
                {(() => {
                  const budgetRegister = editForm.register("budget");
                  return (
                    <Input
                      id="edit-budget"
                      {...budgetRegister}
                      onChange={(e) => {
                        budgetRegister.onChange(e);
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = value.split('.');
                        
                        if (parts[1]?.length > 2) {
                          const formatted = `${parts[0]}.${parts[1].slice(0, 2)}`;
                          editForm.setValue("budget", formatted);
                          e.target.value = formatted;
                        } else {
                          editForm.setValue("budget", value);
                        }
                      }}
                      onBlur={(e) => {
                        budgetRegister.onBlur(e);
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        if (value) {
                          const parts = value.split('.');
                          const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                          const formatted = parts[1] !== undefined 
                            ? `${integerPart}.${parts[1].padEnd(2, '0').slice(0, 2)}`
                            : `${integerPart}.00`;
                          editForm.setValue("budget", value);
                          e.target.value = formatted;
                        }
                      }}
                      onFocus={(e: FocusEvent<HTMLInputElement>) => {
                        const value = e.target.value.replace(/,/g, '');
                        e.target.value = value;
                      }}
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                      data-testid="input-edit-budget"
                    />
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-currency">Currency</Label>
                <Select
                  value={editForm.watch("currency") || "USD"}
                  onValueChange={(value) => editForm.setValue("currency", value)}
                >
                  <SelectTrigger id="edit-currency" data-testid="select-edit-currency">
                    <SelectValue placeholder="USD" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-conversionValue">Conversion Value (optional)</Label>
                {(() => {
                  const conversionValueRegister = editForm.register("conversionValue");
                  return (
                    <Input
                      id="edit-conversionValue"
                      {...conversionValueRegister}
                      onChange={(e) => {
                        conversionValueRegister.onChange(e);
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = value.split('.');
                        
                        if (parts[1]?.length > 2) {
                          const formatted = `${parts[0]}.${parts[1].slice(0, 2)}`;
                          editForm.setValue("conversionValue", formatted);
                          e.target.value = formatted;
                        } else {
                          editForm.setValue("conversionValue", value);
                        }
                      }}
                      onBlur={(e) => {
                        conversionValueRegister.onBlur(e);
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        if (value) {
                          const parts = value.split('.');
                          const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                          const formatted = parts[1] !== undefined 
                            ? `${integerPart}.${parts[1].padEnd(2, '0').slice(0, 2)}`
                            : `${integerPart}.00`;
                          editForm.setValue("conversionValue", value);
                          e.target.value = formatted;
                        }
                      }}
                      onFocus={(e: FocusEvent<HTMLInputElement>) => {
                        const value = e.target.value.replace(/,/g, '');
                        e.target.value = value;
                      }}
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                      min="0"
                      data-testid="input-edit-conversion-value"
                    />
                  );
                })()}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Average revenue per conversion for ROI calculations
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-conversionCurrency">Currency</Label>
                <Select
                  value={editForm.watch("currency") || "USD"}
                  onValueChange={(value) => editForm.setValue("currency", value)}
                >
                  <SelectTrigger id="edit-conversionCurrency" data-testid="select-edit-conversion-currency">
                    <SelectValue placeholder="USD" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-startDate">Start Date</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  {...editForm.register("startDate")}
                  data-testid="input-edit-start-date"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-endDate">End Date</Label>
                <Input
                  id="edit-endDate"
                  type="date"
                  {...editForm.register("endDate")}
                  data-testid="input-edit-end-date"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setEditingCampaign(null)}
                disabled={updateCampaignMutation.isPending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updateCampaignMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateCampaignMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState, useEffect, type FocusEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle, Info, Loader2 } from "lucide-react";
import { SiFacebook, SiGoogle, SiLinkedin, SiX } from "react-icons/si";
import { insertCampaignSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClient } from "@/lib/clientContext";
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

const platforms = [
  { id: "google-analytics", name: "Google Analytics", icon: SiGoogle, color: "text-orange-500", description: "Connect your Google Analytics account" },
  { id: "google-sheets", name: "Google Sheets", icon: SiGoogle, color: "text-green-500", description: "Connect Google Sheets for data import/export" },
  { id: "facebook", name: "Facebook Ads", icon: SiFacebook, color: "text-blue-600", description: "Connect your Facebook Ads account" },
  { id: "google-ads", name: "Google Ads", icon: SiGoogle, color: "text-red-500", description: "Connect your Google Ads account" },
  { id: "linkedin", name: "LinkedIn Ads", icon: SiLinkedin, color: "text-blue-700", description: "Connect your LinkedIn Ads account" },
  { id: "twitter", name: "X (Twitter) Ads", icon: SiX, color: "text-foreground", description: "Connect your X (Twitter) Ads account" },
];

export default function CampaignCreationWizard() {
  const { selectedClientId } = useClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedWizardPlatform, setSelectedWizardPlatform] = useState<string | null>(null);
  const [wizardPlatformConnected, setWizardPlatformConnected] = useState(false);
  const [campaignData, setCampaignData] = useState<CampaignFormData | null>(null);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [draftFinalized, setDraftFinalized] = useState(false);
  const [linkedInImportComplete, setLinkedInImportComplete] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [ga4CampaignFilter, setGa4CampaignFilter] = useState<string>("");

  // GA4 wizard state (Step 4)
  const [ga4Properties, setGA4Properties] = useState<Array<{ id: string; name: string; account?: string }>>([]);
  const [selectedGA4Property, setSelectedGA4Property] = useState<string>('');
  const [isGA4PropertyLoading, setIsGA4PropertyLoading] = useState(false);
  const [ga4CampaignValues, setGA4CampaignValues] = useState<Array<{ name: string; users: number }>>([]);
  const [selectedGA4CampaignValues, setSelectedGA4CampaignValues] = useState<string[]>([]);
  const [isGA4CampaignLoading, setIsGA4CampaignLoading] = useState(false);
  const [ga4ConfigSubStep, setGa4ConfigSubStep] = useState<'property' | 'campaigns'>('property');

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: { name: "", clientWebsite: "", label: "", budget: "", industry: "" },
  });

  // Clean up draft campaign on unmount (e.g., navigating away)
  useEffect(() => {
    return () => {
      if (draftCampaignId && !draftFinalized) {
        apiRequest("DELETE", `/api/campaigns/${draftCampaignId}`).catch(() => {});
      }
    };
  }, [draftCampaignId, draftFinalized]);

  const createCampaignMutation = useMutation({
    mutationFn: async (data: CampaignFormData & { platform?: string; status?: string; type?: string; impressions?: number; clicks?: number; spend?: string; ga4CampaignFilter?: string }) => {
      const payload = {
        name: data.name,
        clientId: selectedClientId || null,
        clientWebsite: data.clientWebsite || null,
        label: data.label || null,
        budget: data.budget ? parseFloat(data.budget) : null,
        currency: data.currency || "USD",
        conversionValue: data.conversionValue ? parseFloat(data.conversionValue as any) : null,
        ga4CampaignFilter: (data as any).ga4CampaignFilter || null,
        industry: data.industry || null,
        type: data.type || "campaign",
        platform: data.platform || "manual",
        impressions: data.impressions || 0,
        clicks: data.clicks || 0,
        spend: data.spend || "0",
        status: data.status || "active",
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      };
      const response = await apiRequest("POST", "/api/campaigns", payload);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create campaign');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create campaign.", variant: "destructive" });
    },
  });

  // Step 1: Submit form → create draft → advance to Step 2
  const handleSubmit = async (data: CampaignFormData) => {
    setCampaignData(data);
    setDraftFinalized(false);
    try {
      const payload = {
        ...data,
        ga4CampaignFilter: ga4CampaignFilter || undefined,
        industry: data.industry || undefined,
        platform: "manual",
        status: "draft" as const,
        type: "campaign" as const,
        impressions: 0,
        clicks: 0,
        spend: "0",
      };
      const created: any = await new Promise((resolve, reject) => {
        createCampaignMutation.mutate(payload as any, {
          onSuccess: (c) => resolve(c),
          onError: reject,
        });
      });
      const id = String(created?.id || "").trim();
      if (!id) throw new Error("Missing campaign id");
      setDraftCampaignId(id);
      setWizardStep(2);
    } catch {
      setDraftCampaignId(null);
      setWizardStep(1);
    }
  };

  // Step 5: Finalize campaign
  const handleFinalize = async () => {
    if (!campaignData || !draftCampaignId) return;
    try {
      const response = await apiRequest("PATCH", `/api/campaigns/${draftCampaignId}`, {
        platform: connectedPlatforms.join(", "),
        ga4CampaignFilter: ga4CampaignFilter || null,
        status: "active",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to finalize campaign');
      }
      setDraftFinalized(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign created", description: "Your new campaign has been created successfully." });
      setLocation(`/campaigns?created=${encodeURIComponent(draftCampaignId)}`);
    } catch (e: any) {
      toast({ title: "Error finalizing campaign", description: e?.message || "Failed to activate campaign.", variant: "destructive" });
    }
  };

  // Cancel: clean up draft and go back to campaigns list
  const handleCancel = () => {
    if (draftCampaignId && !draftFinalized) {
      apiRequest("DELETE", `/api/campaigns/${draftCampaignId}`).catch(() => {});
      setDraftFinalized(true); // prevent cleanup effect from also deleting
    }
    setLocation("/campaigns");
  };

  // GA4 helpers
  const loadWizardGA4Properties = async () => {
    if (!draftCampaignId) return;
    setIsGA4PropertyLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(draftCampaignId)}/ga4-connection-status`, { credentials: 'include' });
      const data = await response.json();
      if (data.connected && Array.isArray(data.properties) && data.properties.length > 0) {
        const validProperties = data.properties.filter((p: { id: string }) => p.id);
        setGA4Properties(validProperties);
        setSelectedGA4Property(validProperties[0]?.id || '');
        setGa4ConfigSubStep('property');
        setWizardStep(4);
      } else if (data.connected && data.propertyId) {
        setConnectedPlatforms(prev => prev.includes('google-analytics') ? prev : [...prev, 'google-analytics']);
        setWizardPlatformConnected(true);
        setWizardStep(5);
        toast({ title: "GA4 Connected", description: "Your Google Analytics property is already linked." });
      } else {
        toast({ title: "Connection Pending", description: "Could not fetch GA4 properties. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error('GA4 property load error:', error);
      toast({ title: "Connection Failed", description: "Failed to retrieve Google Analytics properties.", variant: "destructive" });
    } finally {
      setIsGA4PropertyLoading(false);
    }
  };

  const handleWizardPropertySelection = async () => {
    if (!selectedGA4Property || !draftCampaignId) return;
    setIsGA4PropertyLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(draftCampaignId)}/ga4-property`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ propertyId: selectedGA4Property }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setConnectedPlatforms(prev => prev.includes('google-analytics') ? prev : [...prev, 'google-analytics']);
        setWizardPlatformConnected(true);
        toast({ title: "GA4 Property Connected!", description: "Now select which campaigns to track." });
        try {
          setIsGA4CampaignLoading(true);
          const valsResp = await fetch(
            `/api/campaigns/${encodeURIComponent(draftCampaignId)}/ga4-campaign-values?dateRange=30days&limit=50&propertyId=${encodeURIComponent(selectedGA4Property)}`,
            { credentials: 'include' },
          );
          const valsJson = await valsResp.json().catch(() => null);
          const vals = Array.isArray(valsJson?.campaigns) ? valsJson.campaigns : [];
          setGA4CampaignValues(vals);
          setSelectedGA4CampaignValues(vals.length > 0 ? [vals[0].name] : []);
          setGa4ConfigSubStep('campaigns');
        } catch {
          setGA4CampaignValues([]);
          setSelectedGA4CampaignValues([]);
          setGa4ConfigSubStep('campaigns');
        } finally {
          setIsGA4CampaignLoading(false);
        }
      } else {
        throw new Error(data?.message || "Failed to connect property");
      }
    } catch (error) {
      console.error('Property selection error:', error);
      toast({ title: "Selection Failed", description: "Failed to connect to the selected property.", variant: "destructive" });
    } finally {
      setIsGA4PropertyLoading(false);
    }
  };

  const handleWizardSaveGA4Filter = () => {
    const values = selectedGA4CampaignValues.map(v => v.trim()).filter(Boolean);
    if (values.length === 0) {
      toast({ title: "Campaign required", description: "Select at least one GA4 campaign to scope analytics.", variant: "destructive" });
      return;
    }
    const filterValue = values.length === 1 ? values[0] : JSON.stringify(values);
    setGa4CampaignFilter(filterValue);
    toast({
      title: "GA4 campaigns selected",
      description: values.length === 1 ? `Tracking GA4 campaign "${values[0]}".` : `Tracking ${values.length} GA4 campaigns.`,
    });
    setWizardStep(5);
  };

  // Step titles
  const stepTitle = wizardStep === 1 ? "Campaign Details" :
    wizardStep === 2 ? "Select Platform" :
    wizardStep === 3 ? `Connect ${platforms.find(p => p.id === selectedWizardPlatform)?.name || "Platform"}` :
    wizardStep === 4 ? `Configure ${platforms.find(p => p.id === selectedWizardPlatform)?.name || "Platform"}` :
    "Confirm & Create";

  const stepDescription = wizardStep === 1 ? "Set up a new marketing campaign with your preferred settings." :
    wizardStep === 2 ? "Choose a platform to connect. You can add more later." :
    wizardStep === 3 ? "Authenticate with your platform account." :
    wizardStep === 4 ? "Configure your platform connection settings." :
    "Review your campaign details and create.";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Back link */}
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
            onClick={handleCancel}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Campaigns
          </button>

          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{stepTitle}</h1>
              <p className="text-muted-foreground mt-1">{stepDescription}</p>
            </div>

            {/* 5-step progress indicator */}
            <div className="flex items-center gap-1 mb-8">
              {[
                { step: 1 as const, label: "Details" },
                { step: 2 as const, label: "Platform" },
                { step: 3 as const, label: "Auth" },
                { step: 4 as const, label: "Configure" },
                { step: 5 as const, label: "Confirm" },
              ].map(({ step, label }, i) => {
                const isActive = step === wizardStep;
                const isComplete = step < wizardStep;
                return (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium shrink-0 ${
                      isComplete ? "bg-green-500 text-white" :
                      isActive ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isComplete ? "✓" : step}
                    </div>
                    <span className={`text-sm ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    {i < 4 && <div className={`flex-1 h-px ${isComplete ? "bg-green-500" : "bg-border"}`} />}
                  </div>
                );
              })}
            </div>

            {/* Step content */}
            <Card>
              <CardContent className="p-6">

                {/* Step 1: Campaign Details */}
                {wizardStep === 1 && (
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="name">Campaign Name *</Label>
                        <div className="group relative">
                          <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2 bg-slate-900 text-white text-xs rounded shadow-lg">
                            <p className="font-medium mb-1">Campaign Name Tip</p>
                            <p>Using the same campaign name across all data sources improves automatic conversion value calculation accuracy.</p>
                          </div>
                        </div>
                      </div>
                      <Input id="name" placeholder="Enter campaign name" {...form.register("name")} />
                      {form.formState.errors.name && (
                        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clientWebsite">Client's Website (optional)</Label>
                      <Input id="clientWebsite" type="url" placeholder="https://example.com" {...form.register("clientWebsite")} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="label">Label (optional)</Label>
                      <Input id="label" placeholder="Add a label or tag" {...form.register("label")} />
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
                                e.target.value = e.target.value.replace(/,/g, '');
                              }}
                              placeholder="0.00"
                              type="text"
                              inputMode="decimal"
                            />
                          );
                        })()}
                        <p className="text-xs text-muted-foreground/70">
                          Add your total campaign budget to enable spend tracking and pacing alerts in Insights.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select value={form.watch("currency") || "USD"} onValueChange={(value) => form.setValue("currency", value)}>
                          <SelectTrigger id="currency"><SelectValue placeholder="USD" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="JPY">JPY</SelectItem>
                            <SelectItem value="AUD">AUD</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                            <SelectItem value="BRL">BRL</SelectItem>
                            <SelectItem value="MXN">MXN</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                            <SelectItem value="SEK">SEK</SelectItem>
                            <SelectItem value="NZD">NZD</SelectItem>
                            <SelectItem value="SGD">SGD</SelectItem>
                            <SelectItem value="HKD">HKD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date (optional)</Label>
                        <Input id="startDate" type="date" {...form.register("startDate")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date (optional)</Label>
                        <Input id="endDate" type="date" {...form.register("endDate")} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t">
                      <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1" disabled={createCampaignMutation.isPending}>
                        {createCampaignMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Next"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Step 2: Select Platform */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {platforms.map((platform) => {
                        const Icon = platform.icon;
                        const isConnected = connectedPlatforms.includes(platform.id);
                        const isComingSoon = ['google-ads', 'twitter'].includes(platform.id);
                        return (
                          <button
                            key={platform.id}
                            type="button"
                            onClick={() => {
                              if (isComingSoon) {
                                toast({ title: "Coming Soon", description: `${platform.name} integration will be available soon.` });
                                return;
                              }
                              if (isConnected) return;
                              setSelectedWizardPlatform(platform.id);
                              setWizardStep(3);
                            }}
                            disabled={isConnected}
                            className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                              isConnected ? 'border-green-500 bg-green-50 dark:bg-green-950/20 cursor-default' :
                              isComingSoon ? 'border-border opacity-50 cursor-not-allowed' :
                              'border-border hover:border-primary hover:bg-primary/5 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`w-6 h-6 ${platform.color}`} />
                              <div>
                                <div className="font-medium text-sm">{platform.name}</div>
                                {isConnected && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Connected
                                  </span>
                                )}
                                {isComingSoon && !isConnected && (
                                  <span className="text-xs text-muted-foreground">Coming Soon</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-center pt-2">
                      <button type="button" className="text-sm text-muted-foreground hover:text-foreground underline" onClick={() => setWizardStep(5)}>
                        Skip — connect later
                      </button>
                    </div>
                    <div className="flex pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Authenticate */}
                {wizardStep === 3 && selectedWizardPlatform && (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-muted/30">
                      {selectedWizardPlatform === 'google-analytics' && (
                        <IntegratedGA4Auth
                          campaignId={draftCampaignId || ""}
                          onSuccess={() => { void loadWizardGA4Properties(); }}
                          onError={(error) => { toast({ title: "Connection Failed", description: error || "Unable to complete Google Analytics connection.", variant: "destructive" }); }}
                        />
                      )}
                      {selectedWizardPlatform === 'google-sheets' && (
                        <SimpleGoogleSheetsAuth
                          campaignId={draftCampaignId || ""}
                          onSuccess={() => {
                            setConnectedPlatforms(prev => prev.includes('google-sheets') ? prev : [...prev, 'google-sheets']);
                            setWizardPlatformConnected(true);
                            toast({ title: "Google Sheets Connected!", description: "Successfully connected to your spreadsheet data." });
                            setWizardStep(5);
                          }}
                          onError={(error) => { toast({ title: "Connection Failed", description: error, variant: "destructive" }); }}
                        />
                      )}
                      {selectedWizardPlatform === 'linkedin' && (
                        <LinkedInConnectionFlow
                          campaignId={draftCampaignId || ""}
                          mode="new"
                          onConnectionSuccess={() => {
                            setConnectedPlatforms(prev => prev.includes('linkedin') ? prev : [...prev, 'linkedin']);
                            setWizardPlatformConnected(true);
                            toast({ title: "LinkedIn Ads Connected!", description: "Successfully connected to your LinkedIn ad account." });
                          }}
                          onImportComplete={() => {
                            setLinkedInImportComplete(true);
                            setWizardStep(5);
                          }}
                        />
                      )}
                      {selectedWizardPlatform === 'facebook' && (
                        <SimpleMetaAuth
                          campaignId={draftCampaignId || ""}
                          onSuccess={() => {
                            setConnectedPlatforms(prev => prev.includes('facebook') ? prev : [...prev, 'facebook']);
                            setWizardPlatformConnected(true);
                            toast({ title: "Meta/Facebook Ads Connected!", description: "Successfully connected to your Meta ad account." });
                            setWizardStep(5);
                          }}
                          onError={(error) => { toast({ title: "Connection Failed", description: error, variant: "destructive" }); }}
                        />
                      )}
                    </div>
                    <div className="flex pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => { setSelectedWizardPlatform(null); setWizardPlatformConnected(false); setWizardStep(2); }}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: Configure (GA4 property + campaign filter) */}
                {wizardStep === 4 && (
                  <div className="space-y-4">
                    {selectedWizardPlatform === 'google-analytics' && ga4ConfigSubStep === 'property' && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Choose which Google Analytics property to connect for this campaign.</p>
                        <div className="space-y-2">
                          <Label>GA4 Property</Label>
                          <Select value={selectedGA4Property} onValueChange={setSelectedGA4Property}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select a GA4 property" /></SelectTrigger>
                            <SelectContent>
                              {ga4Properties.filter(p => p.id).map((property) => (
                                <SelectItem key={property.id} value={property.id}>
                                  <div className="flex flex-col text-left">
                                    <span className="font-medium">{property.name}</span>
                                    {property.account && <span className="text-xs text-muted-foreground">Account: {property.account}</span>}
                                    <span className="text-xs text-muted-foreground">ID: {property.id}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setWizardStep(3)}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                          </Button>
                          <Button type="button" className="flex-1" onClick={handleWizardPropertySelection} disabled={!selectedGA4Property || isGA4PropertyLoading}>
                            {isGA4PropertyLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</> : "Connect Property"}
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedWizardPlatform === 'google-analytics' && ga4ConfigSubStep === 'campaigns' && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Select which GA4 campaigns (UTM campaign values) to track.</p>
                        {isGA4CampaignLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading campaigns...
                          </div>
                        ) : ga4CampaignValues.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedGA4CampaignValues(ga4CampaignValues.map(c => c.name))}>Select All</Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedGA4CampaignValues([])}>Clear</Button>
                              <span className="text-xs text-muted-foreground ml-auto">{selectedGA4CampaignValues.length} of {ga4CampaignValues.length} selected</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                              {ga4CampaignValues.map((c) => {
                                const checked = selectedGA4CampaignValues.includes(c.name);
                                return (
                                  <label key={c.name} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                                    <Checkbox checked={checked} onCheckedChange={(val) => {
                                      if (val) setSelectedGA4CampaignValues(prev => [...prev, c.name]);
                                      else setSelectedGA4CampaignValues(prev => prev.filter(v => v !== c.name));
                                    }} />
                                    <span className="text-sm flex-1">{c.name}</span>
                                    <span className="text-xs text-muted-foreground">{c.users.toLocaleString()} users</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>GA4 campaignName</Label>
                            <Input value={selectedGA4CampaignValues[0] || ''} onChange={(e) => setSelectedGA4CampaignValues(e.target.value ? [e.target.value] : [])} placeholder="e.g., brand_awareness" />
                            <p className="text-xs text-muted-foreground">If GA4 reporting is delayed, enter the expected UTM campaign value.</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setGa4ConfigSubStep('property')}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                          </Button>
                          <Button type="button" className="flex-1" onClick={handleWizardSaveGA4Filter} disabled={selectedGA4CampaignValues.length === 0}>
                            {selectedGA4CampaignValues.length > 1 ? `Save ${selectedGA4CampaignValues.length} campaigns` : "Save & Continue"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: Confirm & Create */}
                {wizardStep === 5 && (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Campaign Name</span>
                        <span className="font-medium">{campaignData?.name}</span>
                      </div>
                      {campaignData?.budget && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Budget</span>
                          <span className="font-medium">{campaignData.budget} {campaignData?.currency || 'USD'}</span>
                        </div>
                      )}
                      {(campaignData?.startDate || campaignData?.endDate) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Dates</span>
                          <span className="font-medium">
                            {campaignData?.startDate ? String(campaignData.startDate).slice(0, 10) : '—'} → {campaignData?.endDate ? String(campaignData.endDate).slice(0, 10) : '—'}
                          </span>
                        </div>
                      )}
                      <div className="border-t pt-3">
                        <div className="text-sm text-muted-foreground mb-2">Connected Platforms</div>
                        {connectedPlatforms.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {connectedPlatforms.map(id => {
                              const p = platforms.find(pl => pl.id === id);
                              if (!p) return null;
                              const Icon = p.icon;
                              return (
                                <Badge key={id} variant="outline" className="flex items-center gap-1.5 py-1 px-2">
                                  <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                                  {p.name}
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No platforms connected yet. You can connect them later from the campaign detail page.</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => { setSelectedWizardPlatform(null); setWizardPlatformConnected(false); setWizardStep(2); }}
                    >
                      + Add another platform
                    </button>
                    <div className="flex items-center gap-3 pt-4 border-t">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setWizardStep(2)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={handleFinalize}
                        disabled={createCampaignMutation.isPending}
                      >
                        {createCampaignMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                        ) : (
                          <>Create Campaign <CheckCircle className="w-4 h-4 ml-2" /></>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

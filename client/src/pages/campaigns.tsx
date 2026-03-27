import { useState, useEffect, type FocusEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Campaign, insertCampaignSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClient } from "@/lib/clientContext";

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

export default function Campaigns() {
  const { selectedClientId } = useClient();
  const [, setLocation] = useLocation();
  const [highlightCampaignId, setHighlightCampaignId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const { toast } = useToast();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns", { clientId: selectedClientId }],
    queryFn: async () => {
      const url = selectedClientId
        ? `/api/campaigns?clientId=${encodeURIComponent(selectedClientId)}`
        : "/api/campaigns";
      console.log('🔍 [Campaigns Query] Fetching campaigns for clientId:', selectedClientId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      console.log('✅ [Campaigns Query] Received campaigns:', data.length, 'campaigns');
      return data;
    },
  });

  // If we arrive on /campaigns?created=..., highlight the new campaign card.
  useEffect(() => {
    try {
      const created = new URLSearchParams(window.location.search).get("created");
      const id = String(created || "").trim();
      if (!id) return;
      setHighlightCampaignId(id);
      // Best-effort scroll to the new card (after list render)
      setTimeout(() => {
        const el = document.querySelector(`[data-campaign-id="${CSS.escape(id)}"]`);
        if (el && "scrollIntoView" in el) {
          (el as any).scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 250);
      // Clear highlight after a short time
      const t = setTimeout(() => setHighlightCampaignId(null), 6000);
      return () => clearTimeout(t);
    } catch {
      // ignore
    }
  }, []);

  // Fetch connected platforms for edit dialog
  const { data: editDialogPlatformsData } = useQuery<{ statuses: Array<{ id: string; name: string; connected: boolean; conversionValue?: string | null }> }>({
    queryKey: ["/api/campaigns", editingCampaign?.id, "connected-platforms"],
    enabled: !!editingCampaign?.id,
  });


  const editForm = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      clientWebsite: "",
      label: "",
      budget: "",
      industry: "",
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
      // Also invalidate the specific campaign query so LinkedIn analytics refreshes
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", variables.id] });
      // Invalidate LinkedIn import sessions to pick up conversion value changes
      queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"] });
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

  const seedDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seed-yesop-campaigns", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to seed demo campaigns");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Demo campaigns seeded",
        description: data?.message || `Created ${data?.created?.length || 0} campaign(s).`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Seeding failed", description: error.message, variant: "destructive" });
    },
  });



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
        return "fas fa-ad text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-accent/10 text-accent border-accent/20">Active</Badge>;
      case "paused":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Paused</Badge>;
      case "completed":
        return <Badge className="bg-muted text-muted-foreground border-border">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };


  return (
    <div className="min-h-screen bg-background">

      <Navigation />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Campaign Management</h1>
                <p className="text-muted-foreground/70 mt-1">Create, manage, and optimize your marketing campaigns</p>
              </div>

              <Button onClick={() => setLocation("/campaigns/new")}>
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </div>
          </div>
          {/* Campaigns Cards */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">All Campaigns</h2>
                <p className="text-muted-foreground/70">Manage and monitor your marketing campaigns</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedDemoMutation.mutate()}
                disabled={seedDemoMutation.isPending}
                title="Create 5 pre-seeded Yesop demo campaigns with GA4 connections and known data values"
              >
                {seedDemoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Seed Demo Campaigns
              </Button>
            </div>

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-lg font-medium text-foreground mb-2">No campaigns found</div>
                  <p className="text-muted-foreground/70 mb-4">Get started by creating your first marketing campaign</p>
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
                    <Card
                      data-campaign-id={campaign.id}
                      className={`hover:shadow-md transition-shadow cursor-pointer ${highlightCampaignId && String(highlightCampaignId) === String(campaign.id)
                        ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
                        : ""
                        }`}
                    >
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground/70">
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    <SelectValue placeholder="USD - US Dollar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                    <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                    <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                    <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                    <SelectItem value="SEK">SEK - Swedish Krona</SelectItem>
                    <SelectItem value="NZD">NZD - New Zealand Dollar</SelectItem>
                    <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                    <SelectItem value="HKD">HKD - Hong Kong Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-conversionValue">Conversion Value (optional)</Label>
                {(() => {
                  const connectedPlatforms = editDialogPlatformsData?.statuses?.filter(p => p.connected) || [];
                  const hasMultiplePlatforms = connectedPlatforms.length > 1;

                  // If multiple platforms, disable the field and show message
                  if (hasMultiplePlatforms) {
                    return (
                      <div className="space-y-2">
                        <Input
                          id="edit-conversionValue"
                          disabled
                          placeholder="Multiple platforms - see status above"
                          className="bg-muted"
                          data-testid="input-edit-conversion-value"
                        />
                        <p className="text-xs text-muted-foreground/70">
                          This field is disabled when multiple platforms are connected. Each platform has its own conversion value.
                        </p>
                      </div>
                    );
                  }

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
                <p className="text-xs text-muted-foreground/70">
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
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                    <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                    <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                    <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                    <SelectItem value="SEK">SEK - Swedish Krona</SelectItem>
                    <SelectItem value="NZD">NZD - New Zealand Dollar</SelectItem>
                    <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                    <SelectItem value="HKD">HKD - Hong Kong Dollar</SelectItem>
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
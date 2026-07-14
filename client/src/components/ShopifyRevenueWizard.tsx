import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ClipboardCheck, DollarSign, Link2, Loader2, Target } from "lucide-react";

type Step = "campaign-field" | "crosswalk" | "revenue" | "review" | "complete";
type UniqueValue = { value: string; count: number };

export function ShopifyRevenueWizard(props: {
  campaignId: string;
  sourceId?: string;
  onBack?: () => void;
  onClose?: () => void;
  onSuccess?: (result: any) => void;
  /**
   * Used to prevent cross-platform leakage of revenue metrics.
   * Example: GA4 revenue sources must not unlock LinkedIn revenue metrics.
   */
  platformContext?: "ga4" | "linkedin" | "meta" | "google_ads" | "instagram" | "tiktok" | "google_sheets" | "custom_integration";
  /**
   * Optional: parent-driven navigation (used by outer modal Back button).
   */
  externalStep?: Step;
  externalNavNonce?: number;
  onStepChange?: (step: Step) => void;
  mode?: "connect" | "edit";
  initialMappingConfig?: {
    sourceId?: string;
    campaignField?: string;
    selectedValues?: string[];
    revenueMetric?: string;
    campaignMappings?: Array<{ crmValue: string; linkedinCampaignUrn: string; linkedinCampaignName: string }>;
    campaignDisplayName?: string;
  } | null;
}) {
  const { campaignId, sourceId, onBack, onClose, onSuccess, platformContext = "ga4", externalStep, externalNavNonce, onStepChange, mode = "connect", initialMappingConfig } = props;
  const { toast } = useToast();
  const isGA4 = platformContext === "ga4";
  const isLinkedIn = platformContext === "linkedin";
  const isGoogleAds = platformContext === "google_ads";
  const isMeta = platformContext === "meta";
  const isInstagram = platformContext === "instagram";
  const isTikTok = platformContext === "tiktok";

  const [step, setStep] = useState<Step>("campaign-field");
  // Allow parent (outer modal Back button) to drive navigation back to the connect screen.
  useEffect(() => {
    if (!externalStep) return;
    setStep(externalStep);
  }, [externalStep, externalNavNonce]);

  // Report current step up to the parent for smarter Back behavior.
  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  // Treat Shopify revenue as "to date" (campaign lifetime-style) to avoid confusing windowing.
  // We keep a long lookback under the hood but do not expose it in the UI.
  const [days] = useState<number>(3650);
  const [campaignField, setCampaignField] = useState<string>("utm_campaign");
  const revenueMetric = "current_total_price";
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // OAuth / connection
  const [shopName, setShopName] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState<string>(() => {
    if (mode !== "edit") return "";
    try {
      return localStorage.getItem(`mm:shopifyDomain:${campaignId}`) || "";
    } catch {
      return "";
    }
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connectMethod, setConnectMethod] = useState<"oauth" | "token">("oauth");
  const [adminToken, setAdminToken] = useState<string>("");

  const [valuesLoading, setValuesLoading] = useState(false);
  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [campaignDisplayName, setCampaignDisplayName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const loadedValuesFieldRef = useRef<string>("");

  useEffect(() => {
    if (mode !== "edit" || !initialMappingConfig) return;
    const nextField = String(initialMappingConfig.campaignField || "utm_campaign");
    setCampaignField(nextField);
    loadedValuesFieldRef.current = nextField;
    setSelectedValues(Array.isArray(initialMappingConfig.selectedValues) ? initialMappingConfig.selectedValues.map(String) : []);
    setCampaignDisplayName(String(initialMappingConfig.campaignDisplayName || ""));
    setCampaignMappings(Array.isArray(initialMappingConfig.campaignMappings) ? initialMappingConfig.campaignMappings : []);
    setStep("review");
  }, [mode, initialMappingConfig]);

  // Per-platform-campaign mapping (crosswalk enhancement)
  const [platformCampaigns, setPlatformCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [campaignMappings, setCampaignMappings] = useState<Array<{ crmValue: string; linkedinCampaignUrn: string; linkedinCampaignName: string }>>([]);

  const hasEditChanges = useMemo(() => {
    if (mode !== "edit" || !initialMappingConfig) return true;
    const normalize = (cfg: any) => JSON.stringify({
      campaignField: String(cfg?.campaignField || "utm_campaign"),
      selectedValues: Array.isArray(cfg?.selectedValues) ? cfg.selectedValues.map(String).sort() : [],
      revenueMetric: "current_total_price",
      campaignDisplayName: String(cfg?.campaignDisplayName || ""),
      campaignMappings: Array.isArray(cfg?.campaignMappings) ? cfg.campaignMappings : [],
    });
    return normalize({ campaignField, selectedValues, revenueMetric, campaignDisplayName, campaignMappings }) !== normalize(initialMappingConfig);
  }, [campaignDisplayName, campaignField, campaignMappings, initialMappingConfig, mode, revenueMetric, selectedValues]);

  const editSourceId = mode === "edit" ? String(sourceId || initialMappingConfig?.sourceId || "").trim() : "";
  const isRepair = mode === "edit" && !hasEditChanges;

  const campaignFieldLabel = useMemo(() => {
    if (campaignField === "utm_campaign") return "UTM Campaign (recommended)";
    if (campaignField === "utm_source") return "UTM Source";
    if (campaignField === "utm_medium") return "UTM Medium";
    if (campaignField === "discount_code") return "Discount code";
    if (campaignField === "tags") return "Tags";
    return campaignField;
  }, [campaignField]);

  // Fetch selected platform campaigns when per-campaign mapping is supported.
  useEffect(() => {
    if ((!isGA4 && !isLinkedIn && !isGoogleAds && !isMeta && !isInstagram && !isTikTok) || !campaignId) return;
    const url = isGA4
      ? `/api/campaigns/${campaignId}/ga4-campaign-values?dateRange=30days&limit=200`
      : isGoogleAds
      ? `/api/google-ads/${campaignId}/campaigns`
      : isTikTok
        ? `/api/tiktok/${campaignId}/campaigns`
      : isInstagram
        ? `/api/instagram/${campaignId}/campaigns`
      : isMeta
        ? `/api/meta/${campaignId}/campaigns`
        : `/api/campaigns/${campaignId}/linkedin-campaigns`;
    fetch(url, { credentials: "include" })
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(data => {
        const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
        const selectedIds = new Set(Array.isArray(data?.selectedCampaignIds) ? data.selectedCampaignIds.map((id: any) => String(id)) : []);
        setPlatformCampaigns(campaigns
          .filter((campaign: any) => isGA4
            ? true
            : isMeta || isInstagram || isTikTok
            ? (selectedIds.size > 0 ? selectedIds.has(String(campaign?.id || "")) : campaign?.selected !== false)
            : (!isGoogleAds || campaign?.selected !== false))
          .map((campaign: any) => ({
            id: String(campaign?.campaignUrn || campaign?.id || campaign?.name || ""),
            name: String(campaign?.name || campaign?.campaignUrn || campaign?.id || "Unknown"),
          }))
          .filter((campaign: any) => !!campaign.id));
      })
      .catch(() => setPlatformCampaigns([]));
  }, [isGA4, isLinkedIn, isGoogleAds, isInstagram, isMeta, isTikTok, campaignId]);

  const platformCampaignOptions = useMemo(() => {
    const options = new Map<string, { id: string; name: string }>();
    for (const campaign of platformCampaigns) {
      if (campaign.id) options.set(campaign.id, campaign);
    }
    for (const mapping of campaignMappings) {
      const id = String(mapping.linkedinCampaignUrn || "").trim();
      if (id && !options.has(id)) options.set(id, { id, name: mapping.linkedinCampaignName || id });
    }
    return Array.from(options.values());
  }, [campaignMappings, platformCampaigns]);

  const selectedCampaignMappings = useMemo(() => {
    if (!isGA4 && !isLinkedIn && !isGoogleAds && !isMeta && !isInstagram && !isTikTok) return [];
    const selectedSet = new Set(selectedValues.map((value) => String(value || "").trim()).filter(Boolean));
    return campaignMappings.filter((mapping) => (
      selectedSet.has(String(mapping.crmValue || "").trim()) &&
      platformCampaignOptions.some((campaign) => campaign.id === mapping.linkedinCampaignUrn)
    ));
  }, [campaignMappings, isGA4, isGoogleAds, isInstagram, isLinkedIn, isMeta, isTikTok, platformCampaignOptions, selectedValues]);

  const updateCampaignMapping = (crmValue: string, campaignIdValue: string) => {
    const value = String(crmValue || "").trim();
    if (!value) return;
    setCampaignMappings((prev) => {
      const rest = prev.filter((mapping) => String(mapping.crmValue || "").trim() !== value);
      if (!campaignIdValue || campaignIdValue === "__none__") return rest;
      const campaign = platformCampaignOptions.find((item) => item.id === campaignIdValue);
      return [...rest, { crmValue: value, linkedinCampaignUrn: campaignIdValue, linkedinCampaignName: campaign?.name || campaignIdValue }];
    });
  };

  const renderPlatformCampaignMappings = () => {
    if ((!isGA4 && !isLinkedIn && !isGoogleAds && !isMeta && !isInstagram && !isTikTok) || selectedValues.length === 0) return null;
    const platformLabel = isGA4 ? "GA4" : isTikTok ? "TikTok" : isInstagram ? "Instagram" : isGoogleAds ? "Google Ads" : isMeta ? "Meta" : "LinkedIn";
    return (
      <div className="rounded border p-3 space-y-3">
        <Label>{platformLabel} campaign mapping</Label>
        <div className="space-y-2">
          {selectedValues.map((value) => {
            const current = campaignMappings.find((mapping) => String(mapping.crmValue || "").trim() === value);
            return (
              <div key={value} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:items-center">
                <div className="truncate text-sm">{value}</div>
                <Select value={current?.linkedinCampaignUrn || "__none__"} onValueChange={(next) => updateCampaignMapping(value, next)}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${platformLabel} campaign`} />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="__none__">No campaign mapping</SelectItem>
                    {platformCampaignOptions.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const fetchStatus = async (applyExistingConnection = true) => {
    const resp = await fetch(`/api/shopify/${campaignId}/status`, { credentials: "include" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || "Failed to check Shopify connection");
    const isConnected = !!json?.connected;
    if (!applyExistingConnection && isConnected) {
      setConnected(false);
      setShopName(null);
      setConnectMethod("oauth");
      setShopDomain("");
      return false;
    }
    setConnected(isConnected);
    setShopName(isConnected ? (json?.shopName || null) : null);
    if (isConnected) setConnectMethod(String(json?.authType || "").toLowerCase() === "token" ? "token" : "oauth");
    const serverDomain = isConnected ? String(json?.shopDomain || "") : "";
    setShopDomain((prev) => prev || serverDomain);
    if (serverDomain) {
      try {
        localStorage.setItem(`mm:shopifyDomain:${campaignId}`, serverDomain);
      } catch {
        // ignore
      }
    }
    return isConnected;
  };

  const openOAuthWindow = async () => {
    // Normalize domain so users can type either:
    // - "my-store" (we assume my-store.myshopify.com)
    // - "my-store.myshopify.com"
    // - "https://my-store.myshopify.com/..."
    let domain = String(shopDomain || "").trim();
    if (!domain) {
      toast({ title: "Enter your shop domain", description: "Example: your-store.myshopify.com", variant: "destructive" });
      return;
    }
    domain = domain.replace(/^https?:\/\//i, "").split("/")[0].trim().toLowerCase();
    if (domain && !domain.includes(".")) domain = `${domain}.myshopify.com`;
    if (!domain.includes(".")) {
      toast({ title: "Invalid shop domain", description: "Example: your-store.myshopify.com", variant: "destructive" });
      return;
    }
    // Keep state in sync so user sees what we will connect to.
    if (domain !== String(shopDomain || "").trim().toLowerCase()) setShopDomain(domain);

    setIsConnecting(true);
    try {
      const resp = await fetch("/api/auth/shopify/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, shopDomain: domain }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (json?.code === "SHOPIFY_OAUTH_REDIRECT_NOT_CONFIGURED") {
          toast({
            title: "Shopify OAuth setup is incomplete",
            description: "Configure the Shopify app callback URL before connecting with OAuth.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(json?.message || "Failed to start Shopify OAuth");
      }
      const authUrl = json?.authUrl;
      if (!authUrl) throw new Error("No auth URL returned");

      toast({ title: "Opening Shopify", description: `Connecting to ${domain}…` });

      const w = window.open(authUrl, "shopify_oauth", "width=520,height=680");
      if (!w) throw new Error("Popup blocked. Please allow popups and try again.");

      let handled = false;
      let bc: BroadcastChannel | null = null;
      const cleanupOAuthListeners = () => {
        window.removeEventListener("message", onMessage);
        bc?.close();
      };
      const handleOAuthResult = async (data: any) => {
        if (handled) return;
        if (!data || typeof data !== "object") return;

        if (data.type === "shopify_auth_success") {
          handled = true;
          cleanupOAuthListeners();
          await fetchStatus();
          toast({ title: "Shopify Connected", description: "Now map how Shopify orders should be attributed to this campaign." });
          setStep("campaign-field");
        } else if (data.type === "shopify_auth_error") {
          handled = true;
          cleanupOAuthListeners();
          toast({
            title: "Shopify Connection Failed",
            description: data.error || "Please try again.",
            variant: "destructive",
          });
        }
      };
      const onMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        await handleOAuthResult(event.data);
      };

      try {
        bc = new BroadcastChannel("metricmind_oauth");
        bc.onmessage = (event) => void handleOAuthResult((event as any).data);
      } catch {
        bc = null;
      }

      window.addEventListener("message", onMessage);
    } catch (err: any) {
      toast({ title: "Shopify Connection Failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWithToken = async () => {
    // Normalize domain like OAuth flow does
    let domain = String(shopDomain || "").trim();
    if (!domain) {
      toast({ title: "Enter your shop domain", description: "Example: your-store.myshopify.com", variant: "destructive" });
      return;
    }
    domain = domain.replace(/^https?:\/\//i, "").split("/")[0].trim().toLowerCase();
    if (domain && !domain.includes(".")) domain = `${domain}.myshopify.com`;
    if (!domain.includes(".")) {
      toast({ title: "Invalid shop domain", description: "Example: your-store.myshopify.com", variant: "destructive" });
      return;
    }
    if (domain !== String(shopDomain || "").trim().toLowerCase()) setShopDomain(domain);

    const token = String(adminToken || "").trim();
    if (!token || !token.startsWith("shpat_")) {
      toast({ title: "Enter an Admin API token", description: "Paste a token that starts with shpat_.", variant: "destructive" });
      return;
    }

    setIsConnecting(true);
    try {
      const resp = await fetch("/api/shopify/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, shopDomain: domain, accessToken: token }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to connect Shopify");
      await fetchStatus();
      toast({ title: "Shopify Connected", description: "Now map how Shopify orders should be attributed to this campaign." });
      setStep("campaign-field");
    } catch (err: any) {
      toast({ title: "Shopify Connection Failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const steps = useMemo(
    () => [
      { id: "campaign-field" as const, label: "Campaign field", icon: Target },
      { id: "crosswalk" as const, label: "Crosswalk", icon: Link2 },
      { id: "revenue" as const, label: "Revenue", icon: DollarSign },
      { id: "review" as const, label: "Save", icon: ClipboardCheck },
    ],
    []
  );

  const currentStepIndex = useMemo(() => {
    const idx = steps.findIndex((s) => s.id === step);
    return idx >= 0 ? idx : steps.length;
  }, [steps, step]);

  const fetchUniqueValues = async () => {
    setValuesLoading(true);
    try {
      const resp = await fetch(
        `/api/shopify/${campaignId}/orders/unique-values?field=${encodeURIComponent(campaignField)}&days=${encodeURIComponent(
          String(days)
        )}&limit=300`,
        { credentials: "include" }
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status === 403) {
          const protectedDataBlocked = json?.code === "SHOPIFY_PROTECTED_CUSTOMER_DATA_APPROVAL_REQUIRED";
          toast({
            title: protectedDataBlocked ? "Shopify order access blocked" : "Shopify order access denied",
            description: protectedDataBlocked
              ? "Shopify connected, but this OAuth app is not approved for protected customer data needed to read orders. Approve protected customer data for Orders in Shopify, then reconnect."
              : "Shopify connected, but order reads are not approved for this app. Approve the Orders scope in Shopify, then reconnect.",
            variant: "destructive",
          });
        }
        throw new Error(json?.error || "Failed to load values");
      }
      const vals = Array.isArray(json?.values) ? json.values : [];
      setUniqueValues(vals);
      loadedValuesFieldRef.current = campaignField;
      const allowed = new Set(vals.map((v: any) => String(v.value)));
      setSelectedValues((prev) => prev.filter((v) => allowed.has(v)));
    } finally {
      setValuesLoading(false);
    }
  };

  // Load connection status once on mount (prevents visible flashing on step transitions).
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await fetchStatus(mode === "edit");
      } catch {
        // ignore
      } finally {
        if (mounted) setStatusLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, mode]);

  // Fetch crosswalk values only when entering crosswalk.
  useEffect(() => {
    if (step !== "crosswalk") return;
    if (uniqueValues.length > 0 && loadedValuesFieldRef.current === campaignField) return;
    void fetchUniqueValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, campaignField, days]);

  // Persist domain edits so going Back preserves the typed store.
  useEffect(() => {
    try {
      if (shopDomain) localStorage.setItem(`mm:shopifyDomain:${campaignId}`, shopDomain);
    } catch {
      // ignore
    }
  }, [shopDomain, campaignId]);

  const handleBackStep = () => {
    if (step === "campaign-field") {
      onBack?.();
      if (!onBack) onClose?.();
      return;
    }
    if (step === "crosswalk") return setStep("campaign-field");
    if (step === "revenue") return setStep("crosswalk");
    if (step === "review") return setStep("revenue");
    if (step === "complete") return setStep("review");
  };

  const handleNext = async () => {
    if (step === "campaign-field") {
      if (!connected) {
        toast({ title: "Connect Shopify", description: "Connect your Shopify store before continuing.", variant: "destructive" });
        return;
      }
      if (loadedValuesFieldRef.current && loadedValuesFieldRef.current !== campaignField) {
        setUniqueValues([]);
        setSelectedValues([]);
        setCampaignMappings([]);
      }
      setStep("crosswalk");
      return;
    }
    if (step === "crosswalk") {
      if (selectedValues.length === 0) {
        toast({
          title: "Select at least one value",
          description: "Pick the Shopify value(s) that should map to this campaign.",
          variant: "destructive",
        });
        return;
      }
      setStep("revenue");
      return;
    }
    if (step === "revenue") {
      setStep("review");
      return;
    }
    if (step === "review") {
      if (isRepair && !preview?.repairConfirmation) return;
      setIsSaving(true);
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/shopify/save-mappings`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(editSourceId ? { sourceId: editSourceId } : {}),
            campaignField,
            selectedValues,
            revenueMetric,
            days,
            campaignDisplayName: selectedValues.length > 0 ? (campaignDisplayName.trim() || null) : null,
            platformContext,
            valueSource: "revenue",
            revenueClassification: isLinkedIn ? "offsite_not_in_ga4" : "onsite_in_ga4",
            ...((isGA4 || isLinkedIn || isGoogleAds || isMeta || isInstagram || isTikTok) && selectedCampaignMappings.length > 0 ? { campaignMappings: selectedCampaignMappings } : {}),
            ...(isRepair ? { repairConfirmation: preview.repairConfirmation } : {}),
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          if (json?.code === "SHOPIFY_REPAIR_PREVIEW_CHANGED") await fetchPreview();
          throw new Error(json?.error || "Failed to import revenue");
        }
        let repairInventory: any = null;
        if (isRepair) {
          try {
            const inventoryResp = await fetch(`/api/campaigns/${campaignId}/ga4-overview/source-damage-inventory`, {
              credentials: "include",
              cache: "no-store",
            });
            repairInventory = await inventoryResp.json().catch(() => null);
          } catch {
            repairInventory = null;
          }
        }
        const repairPass = repairInventory?.shopifyLocalPersistencePass === true;
        toast(isRepair ? {
          title: repairPass ? "Shopify revenue repaired" : "Shopify revenue refreshed",
          description: repairPass
            ? "The locally verifiable Shopify integrity checks now pass. Provider-only limitations remain."
            : "Revenue was replaced from Shopify, but the post-repair integrity check still needs review.",
          ...(!repairPass ? { variant: "destructive" as const } : {}),
        } : {
          title: "Revenue imported",
          description: `Revenue connected: $${Number(json?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        });
        onSuccess?.({ ...json, ...(isRepair ? { repairInventory } : {}) });
        setStep("complete");
      } catch (err: any) {
        toast({
          title: "Failed to import revenue",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const fetchPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/shopify/save-mappings`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(editSourceId ? { sourceId: editSourceId } : {}),
            campaignField,
            selectedValues,
            revenueMetric,
            days,
            platformContext,
            valueSource: "revenue",
            revenueClassification: isLinkedIn ? "offsite_not_in_ga4" : "onsite_in_ga4",
            campaignDisplayName: selectedValues.length > 0 ? (campaignDisplayName.trim() || null) : null,
            ...((isGA4 || isLinkedIn || isGoogleAds || isMeta || isInstagram || isTikTok) && selectedCampaignMappings.length > 0 ? { campaignMappings: selectedCampaignMappings } : {}),
            dryRun: true,
          }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load preview");
      setPreview(json);
    } catch (error: any) {
      setPreview(null);
      setPreviewError(error?.message || "Failed to load Shopify preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Compute a preview when entering Review (so the final step can show the amount before saving).
  useEffect(() => {
    if (step !== "review") return;
    void fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, campaignField, revenueMetric, days, platformContext, editSourceId, selectedValues.join("|"), campaignDisplayName, selectedCampaignMappings]);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {steps.map((s, index) => {
          const StepIcon = s.icon;
          const isActive = s.id === step;
          const isCompleted = index < currentStepIndex;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white"
                      : isCompleted
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-muted border-border dark:border-slate-600 text-muted-foreground/70"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <p
                  className={`text-xs mt-2 text-center ${
                    isActive ? "text-blue-600 font-medium" : isCompleted ? "text-green-600" : "text-muted-foreground/70"
                  }`}
                >
                  {s.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? "bg-green-600" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {step === "campaign-field" && (
              <>
                <Target className="w-5 h-5 text-blue-600" />
                Select Attribution Field
              </>
            )}
            {step === "crosswalk" && (
              <>
                <Link2 className="w-5 h-5 text-blue-600" />
                Link Campaign to Shopify Value(s)
              </>
            )}
            {step === "revenue" && (
              <>
                <DollarSign className="w-5 h-5 text-green-600" />
                Select Revenue Definition
              </>
            )}
            {step === "review" && (
              <>
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                Review Settings
              </>
            )}
            {step === "complete" && (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Completed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {step === "campaign-field" && `Choose how MimoSaaS should attribute Shopify orders to this ${isLinkedIn ? "LinkedIn" : "campaign"}.`}
            {step === "crosswalk" && "Select the Shopify value(s) that map to this campaign."}
            {step === "revenue" && "Choose what revenue field MimoSaaS should sum from matched orders."}
            {step === "review" && "Confirm your selections and process revenue metrics."}
            {step === "complete" &&
              (isLinkedIn
                ? "Revenue is connected. LinkedIn financial metrics should now recompute immediately."
                : "Revenue metrics processed.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "campaign-field" && (
            <div className="space-y-2">
              {/* Keep this block layout-stable to prevent "jumpy" transitions */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Shopify store</div>
                  {!connected && (
                    <div className="text-xs text-muted-foreground/70 min-h-[16px] transition-opacity duration-200">
                      <span className={statusLoading ? "opacity-0" : "opacity-100"}>
                        Not connected
                      </span>
                    </div>
                  )}
                </div>

                {/* Fixed-height helper text to avoid reflow on connected state */}
                <div className="text-xs text-muted-foreground/70 min-h-[40px]">
                  <div>
                    Connect your Shopify store to import orders and map revenue to this campaign.
                  </div>
                  <div>
                    If Shopify blocks OAuth (protected customer data), use an Admin API token.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Connection method</Label>
                  <RadioGroup value={connectMethod} onValueChange={(v: any) => setConnectMethod(v)} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <RadioGroupItem id="shopify-method-oauth" value="oauth" />
                      <label htmlFor="shopify-method-oauth" className="text-sm font-medium leading-none cursor-pointer">
                        OAuth (recommended)
                      </label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem id="shopify-method-token" value="token" />
                      <label htmlFor="shopify-method-token" className="text-sm font-medium leading-none cursor-pointer">
                        Admin API token (fallback)
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Shop domain</Label>
                    <Input
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      placeholder="your-store.myshopify.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void (connectMethod === "token" ? connectWithToken() : openOAuthWindow())}
                      disabled={isConnecting}
                    >
                      {isConnecting ? "Connecting…" : (connected ? "Reconnect / Change store" : "Connect Shopify")}
                    </Button>
                  </div>
                </div>

                {connectMethod === "token" && (
                  <div className="space-y-1">
                    <Label>Admin API token</Label>
                    <Input
                      type="password"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="shpat_…"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    <div className="text-xs text-muted-foreground">
                      Create this in Shopify Admin → Apps → Develop apps → your app → Admin API access token. Keep it secret.
                    </div>
                  </div>
                )}
                {/* Reserve space to avoid layout shift when connected/shopName arrives */}
                <div className="text-xs text-muted-foreground/70 min-h-[16px] transition-opacity duration-200">
                  <span className={statusLoading ? "opacity-0" : "opacity-100"}>
                    {connected && shopName ? (
                      <>
                        Connected store: <span className="font-medium">{shopName}</span>
                      </>
                    ) : (
                      "\u00A0"
                    )}
                  </span>
                </div>

                {/* Non-shifting loading indicator (no text) */}
                {statusLoading && (
                  <div className="absolute top-3 right-3 text-muted-foreground/70">
                    <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading" />
                  </div>
                )}
              </div>

              <Label>Attribution key</Label>
                <Select value={campaignField} onValueChange={(v) => {
                  setCampaignField(v);
                  setCampaignMappings([]);
                  setCampaignDisplayName("");
                }}>
                <SelectTrigger>
                  <span>{campaignFieldLabel}</span>
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="utm_campaign">UTM Campaign (recommended)</SelectItem>
                  <SelectItem value="utm_source">UTM Source</SelectItem>
                  <SelectItem value="utm_medium">UTM Medium</SelectItem>
                  <SelectItem value="discount_code">Discount code</SelectItem>
                  <SelectItem value="tags">Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {step === "crosswalk" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Selected: <strong>{selectedValues.length}</strong>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchUniqueValues()} disabled={valuesLoading}>
                  {valuesLoading ? "Refreshing…" : "Refresh values"}
                </Button>
              </div>
              <div className="border rounded p-3 max-h-[280px] overflow-y-auto">
                {valuesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading values…</div>
                ) : uniqueValues.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No values found for the selected attribution key.</div>
                ) : (
                  /* Standard checkbox mode */
                  <div className="space-y-2">
                    {uniqueValues.map((v) => {
                      const value = String(v.value);
                      const checked = selectedValues.includes(value);
                      const toggleValue = () => {
                        setSelectedValues((prev) => {
                          if (checked) return prev.filter((x) => x !== value);
                          return Array.from(new Set([...prev, value]));
                        });
                      };
                      return (
                        <div
                          key={value}
                          role="button"
                          tabIndex={0}
                          onClick={toggleValue}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleValue();
                            }
                          }}
                          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${checked ? "border-primary/40 bg-primary/5" : "border-slate-100 hover:bg-muted/50"}`}
                        >
                          <Checkbox
                            checked={checked}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={(next) => {
                              setSelectedValues((prev) => {
                                if (next) return Array.from(new Set([...prev, value]));
                                return prev.filter((x) => x !== value);
                              });
                            }}
                          />
                          <div className="flex-1">
                            <div className="text-sm">{value}</div>
                            <div className="text-xs text-muted-foreground">{v.count} order(s)</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {renderPlatformCampaignMappings()}
            </div>
          )}

          {step === "revenue" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Revenue metric</Label>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  Current total price after returns, refunds, and order adjustments
                </div>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3 text-sm text-foreground/80">
              <div>
                <strong>Attribution key:</strong> {campaignField}
              </div>
              <div>
                <strong>Shopify campaign{selectedValues.length === 1 ? "" : "s"}:</strong>{" "}
                {selectedValues.length === 0 ? "—" : selectedValues.length <= 3 ? selectedValues.join(", ") : `${selectedValues.slice(0, 3).join(", ")} + ${selectedValues.length - 3} more`}
              </div>
              <div>
                <strong>Revenue metric:</strong> Current total price after adjustments
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="font-medium">Preview</div>
                <div className="mt-2 text-sm">
                  {previewLoading ? (
                    <div className="text-muted-foreground">Computing…</div>
                  ) : previewError ? (
                    <div className="text-destructive">{previewError}</div>
                  ) : (
                    <>
                      <div>
                        <strong>Shopify revenue (to date):</strong>{" "}
                        {(() => {
                          const amount = Number(preview?.totalRevenue || 0);
                          const currency = String(preview?.currency || "").trim().toUpperCase();
                          if (!currency) return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          try {
                            return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
                          } catch {
                            return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
                          }
                        })()}
                      </div>
                      <div className="mt-1">
                        <strong>Matched orders:</strong> {Number(preview?.totalConversions || 0)}
                      </div>
                      {(() => {
                        const rows = Array.isArray(preview?.campaignValueRevenueTotals)
                          ? preview.campaignValueRevenueTotals
                          : [];
                        if (rows.length === 0) return null;
                        const rowByValue = new Map(rows.map((row: any) => [String(row?.campaignValue || ""), row]));
                        const orderedRows = selectedValues
                          .map((value) => rowByValue.get(String(value)))
                          .filter(Boolean);
                        const currency = String(preview?.currency || "").trim().toUpperCase();
                        const formatAmount = (amount: number) => {
                          if (!currency) return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          try {
                            return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
                          } catch {
                            return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
                          }
                        };
                        return (
                          <div className="mt-3 rounded border border-border bg-background/70 p-2">
                            <div className="text-xs font-medium text-muted-foreground">Revenue breakdown</div>
                            <div className="mt-2 space-y-1">
                              {orderedRows.map((row: any) => (
                                <div key={String(row?.campaignValue || "")} className="flex items-center justify-between gap-3 text-xs">
                                  <span className="truncate text-foreground/80">{String(row?.campaignValue || "Unmapped")}</span>
                                  <span className="shrink-0 font-medium text-foreground">
                                    {formatAmount(Number(row?.revenue || 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {(() => {
                        const pAmt = preview?.presentmentTotal;
                        const pCur = String(preview?.presentmentCurrency || "").trim().toUpperCase();
                        const shopCur = String(preview?.currency || "").trim().toUpperCase();
                        if (!pCur || pAmt === null || typeof pAmt === "undefined") return null;
                        if (shopCur && pCur === shopCur) return null;
                        const amount = Number(pAmt || 0);
                        let formatted = `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${pCur}`;
                        try {
                          formatted = new Intl.NumberFormat(undefined, { style: "currency", currency: pCur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
                        } catch {
                          // ignore
                        }
                        return (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Customer currency (presentment): <span className="font-medium text-foreground/80 dark:text-slate-200">{formatted}</span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
              {isRepair && preview?.repairConfirmation && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                  Confirm the Shopify preview above. Repair from Shopify atomically replaces only this source's records and preserves the last-good records if replacement fails.
                </div>
              )}
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-3">
              <div className="text-sm text-foreground/80">Revenue metrics processed. ROI/ROAS should now be available in Overview.</div>
              <div className="flex items-center gap-2">
                <Button onClick={() => onClose?.()}>Done</Button>
              </div>
            </div>
          )}

          {step !== "complete" && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleBackStep} disabled={valuesLoading || isSaving}>
                Back
              </Button>
              <Button onClick={() => void handleNext()} disabled={
                valuesLoading || isSaving ||
                (step === "crosswalk" && selectedValues.length === 0) ||
                (step === "review" && isRepair && (previewLoading || !!previewError || !preview?.repairConfirmation))
              }>
                {step === "review" ? (isSaving ? "Processing..." : isRepair ? "Repair from Shopify" : mode === "edit" ? "Update revenue" : "Import revenue") : "Continue"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



import { useEffect, useMemo, useState } from "react";
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
  onBack?: () => void;
  onClose?: () => void;
  onSuccess?: (result: any) => void;
  /**
   * Used to prevent cross-platform leakage of revenue metrics.
   * Example: GA4 revenue sources must not unlock LinkedIn revenue metrics.
   */
  platformContext?: "ga4" | "linkedin" | "meta";
  /**
   * Optional: parent-driven navigation (used by outer modal Back button).
   */
  externalStep?: Step;
  externalNavNonce?: number;
  onStepChange?: (step: Step) => void;
}) {
  const { campaignId, onBack, onClose, onSuccess, platformContext = "ga4", externalStep, externalNavNonce, onStepChange } = props;
  const { toast } = useToast();
  const isLinkedIn = platformContext === "linkedin";

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
  const [revenueMetric, setRevenueMetric] = useState<string>("total_price");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  // OAuth / connection
  const [shopName, setShopName] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState<string>(() => {
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
  const [isSaving, setIsSaving] = useState(false);

  // Per-LinkedIn-campaign mapping (crosswalk enhancement)
  const [linkedinCampaigns, setLinkedinCampaigns] = useState<Array<{ urn: string; name: string; status: string }>>([]);
  const [campaignMappings, setCampaignMappings] = useState<Array<{ crmValue: string; linkedinCampaignUrn: string; linkedinCampaignName: string }>>([]);

  // Fetch LinkedIn campaigns when in linkedin context
  useEffect(() => {
    if (!isLinkedIn || !campaignId) return;
    fetch(`/api/campaigns/${campaignId}/linkedin-campaigns`)
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(data => setLinkedinCampaigns(data.campaigns || []))
      .catch(() => setLinkedinCampaigns([]));
  }, [isLinkedIn, campaignId]);

  const fetchStatus = async () => {
    const resp = await fetch(`/api/shopify/${campaignId}/status`, { credentials: "include" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || "Failed to check Shopify connection");
    const isConnected = !!json?.connected;
    setConnected(isConnected);
    setShopName(isConnected ? (json?.shopName || null) : null);
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
      if (!resp.ok) throw new Error(json?.message || "Failed to start Shopify OAuth");
      const authUrl = json?.authUrl;
      if (!authUrl) throw new Error("No auth URL returned");

      toast({ title: "Opening Shopify", description: `Connecting to ${domain}…` });

      const w = window.open(authUrl, "shopify_oauth", "width=520,height=680");
      if (!w) throw new Error("Popup blocked. Please allow popups and try again.");

      const onMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data: any = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "shopify_auth_success") {
          window.removeEventListener("message", onMessage);
          await fetchStatus();
          toast({ title: "Shopify Connected", description: "Now map how Shopify orders should be attributed to this campaign." });
          setStep("campaign-field");
        } else if (data.type === "shopify_auth_error") {
          window.removeEventListener("message", onMessage);
          toast({
            title: "Shopify Connection Failed",
            description: data.error || "Please try again.",
            variant: "destructive",
          });
        }
      };

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
      { id: "revenue" as const, label: isLinkedIn ? "Revenue / Conversion Value" : "Revenue", icon: DollarSign },
      { id: "review" as const, label: "Save", icon: ClipboardCheck },
    ],
    [isLinkedIn]
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
        // Enterprise-grade: Shopify may block orders access pending merchant approval for read_orders.
        if (resp.status === 403) {
          const shopifyRaw = json?.shopifyError ? `\n\nShopify says: ${json.shopifyError}` : "";
          toast({
            title: "Shopify access denied",
            description: `Shopify returned 403 when reading orders. Ensure your app has read_orders scope enabled, then uninstall and reinstall the app to get a fresh token.${shopifyRaw}`,
            variant: "destructive",
          });
          if (connectMethod !== "token") setConnectMethod("token");
        }
        throw new Error(json?.error || "Failed to load values");
      }
      const vals = Array.isArray(json?.values) ? json.values : [];
      setUniqueValues(vals);
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
        await fetchStatus();
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
  }, [campaignId]);

  // Fetch crosswalk values only when entering crosswalk.
  useEffect(() => {
    if (step !== "crosswalk") return;
    if (uniqueValues.length > 0) return;
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
      setUniqueValues([]);
      setSelectedValues([]);
      setStep("crosswalk");
      return;
    }
    if (step === "crosswalk") {
      const crosswalkEmpty = isLinkedIn && linkedinCampaigns.length > 0
        ? campaignMappings.length === 0
        : selectedValues.length === 0;
      if (crosswalkEmpty) {
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
      setIsSaving(true);
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/shopify/save-mappings`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignField,
            selectedValues,
            revenueMetric,
            days,
            platformContext,
            valueSource: "revenue",
            revenueClassification: isLinkedIn ? "offsite_not_in_ga4" : "onsite_in_ga4",
            ...(isLinkedIn && campaignMappings.length > 0 ? { campaignMappings } : {}),
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || "Failed to process revenue metrics");
        toast({
          title: "Revenue Metrics Processed",
          description:
          `Revenue connected: $${Number(json?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        });
        onSuccess?.(json);
        setStep("complete");
      } catch (err: any) {
        toast({
          title: "Failed to Process Revenue Metrics",
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
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/shopify/save-mappings`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignField,
            selectedValues,
            revenueMetric,
            days,
            platformContext,
            valueSource: "revenue",
            revenueClassification: isLinkedIn ? "offsite_not_in_ga4" : "onsite_in_ga4",
            dryRun: true,
          }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load preview");
      setPreview(json);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Compute a preview when entering Review (so the final step can show the amount before saving).
  useEffect(() => {
    if (step !== "review") return;
    void fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, campaignField, revenueMetric, days, platformContext, selectedValues.join("|")]);

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
                Process Revenue Metrics
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
              <Select value={campaignField} onValueChange={(v) => setCampaignField(v)}>
                <SelectTrigger>
                  <span>{campaignField === "utm_campaign" ? "UTM Campaign (recommended)" : campaignField}</span>
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="utm_campaign">UTM Campaign (recommended)</SelectItem>
                  <SelectItem value="utm_source">UTM Source</SelectItem>
                  <SelectItem value="utm_medium">UTM Medium</SelectItem>
                  <SelectItem value="discount_code">Discount code</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Shopify doesn’t store LinkedIn campaign ids directly by default—UTMs and discount codes are the most common attribution keys.
              </div>
            </div>
          )}

          {step === "crosswalk" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  {isLinkedIn && linkedinCampaigns.length > 0
                    ? <>Mapped: <strong>{campaignMappings.length}</strong> of {uniqueValues.length} values</>
                    : <>Selected: <strong>{selectedValues.length}</strong></>}
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
                ) : isLinkedIn && linkedinCampaigns.length > 0 ? (
                  /* LinkedIn campaign mapping mode */
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground mb-2">
                      Map each Shopify value to a LinkedIn campaign. Unmapped values will be skipped.
                    </div>
                    {uniqueValues.map((v) => {
                      const value = String(v.value);
                      const existing = campaignMappings.find(m => m.crmValue === value);
                      return (
                        <div key={value} className="flex items-center gap-3 p-2 rounded border border-slate-100">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{value}</div>
                            <div className="text-xs text-muted-foreground">{v.count} order(s)</div>
                          </div>
                          <Select
                            value={existing?.linkedinCampaignUrn || "__none__"}
                            onValueChange={(urn) => {
                              setCampaignMappings(prev => {
                                const filtered = prev.filter(m => m.crmValue !== value);
                                if (urn === "__none__") return filtered;
                                const campaign = linkedinCampaigns.find(c => c.urn === urn);
                                return [...filtered, {
                                  crmValue: value,
                                  linkedinCampaignUrn: urn,
                                  linkedinCampaignName: campaign?.name || urn,
                                }];
                              });
                              // Also maintain selectedValues for backward compat
                              setSelectedValues(prev => {
                                if (urn === "__none__") return prev.filter(x => x !== value);
                                return Array.from(new Set([...prev, value]));
                              });
                            }}
                          >
                            <SelectTrigger className="w-[200px] text-xs">
                              <SelectValue placeholder="Select campaign…" />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                              <SelectItem value="__none__">— Skip —</SelectItem>
                              {linkedinCampaigns.map(c => (
                                <SelectItem key={c.urn} value={c.urn}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard checkbox mode */
                  <div className="space-y-2">
                    {uniqueValues.map((v) => {
                      const value = String(v.value);
                      const checked = selectedValues.includes(value);
                      return (
                        <div key={value} className="flex items-start gap-2">
                          <Checkbox
                            checked={checked}
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
            </div>
          )}

          {step === "revenue" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Revenue metric</Label>
                <Select value={revenueMetric} onValueChange={(v) => setRevenueMetric(v)}>
                  <SelectTrigger>
                    <span>{revenueMetric === "total_price" ? "Total price (default)" : "Current total price (after adjustments)"}</span>
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="total_price">Total price (default)</SelectItem>
                    <SelectItem value="current_total_price">Current total price (after adjustments)</SelectItem>
                  </SelectContent>
                </Select>
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
                <strong>Revenue metric:</strong> {revenueMetric}
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">Preview</div>
                  <Button variant="outline" size="sm" onClick={() => void fetchPreview()} disabled={previewLoading || isSaving}>
                    {previewLoading ? "Refreshing…" : "Refresh preview"}
                  </Button>
                </div>
                <div className="mt-2 text-sm">
                  {previewLoading ? (
                    <div className="text-muted-foreground">Computing…</div>
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
                (step === "crosswalk" && (isLinkedIn && linkedinCampaigns.length > 0 ? campaignMappings.length === 0 : selectedValues.length === 0))
              }>
                {step === "review" ? (isSaving ? "Processing…" : "Process Revenue Metrics") : "Continue"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



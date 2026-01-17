import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ClipboardCheck, DollarSign, Link2, Target } from "lucide-react";

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
  platformContext?: "ga4" | "linkedin";
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

  const [days, setDays] = useState<number>(90);
  const [campaignField, setCampaignField] = useState<string>("utm_campaign");
  const [revenueMetric, setRevenueMetric] = useState<string>("total_price");
  const [revenueClassification, setRevenueClassification] = useState<"onsite_in_ga4" | "offsite_not_in_ga4">("onsite_in_ga4");
  const [valueSource, setValueSource] = useState<"revenue" | "conversion_value">("revenue");

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

  const [valuesLoading, setValuesLoading] = useState(false);
  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchStatus = async () => {
    const resp = await fetch(`/api/shopify/${campaignId}/status`);
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
        )}&limit=300`
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load values");
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
      setIsSaving(true);
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/shopify/save-mappings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignField,
            selectedValues,
            revenueMetric,
            revenueClassification,
            days,
            platformContext,
            valueSource: isLinkedIn ? valueSource : "revenue",
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || "Failed to process revenue metrics");
        toast({
          title: "Revenue Metrics Processed",
          description:
            isLinkedIn && String(json?.mode || "") === "conversion_value"
              ? `Conversion value saved: ${Number(json?.conversionValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per conversion.`
              : `Revenue connected: $${Number(json?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
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
                      : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <p
                  className={`text-xs mt-2 text-center ${
                    isActive ? "text-blue-600 font-medium" : isCompleted ? "text-green-600" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? "bg-green-600" : "bg-slate-200 dark:bg-slate-700"}`} />
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
            {step === "campaign-field" && `Choose how MetricMind should attribute Shopify orders to this ${isLinkedIn ? "LinkedIn" : "campaign"}.`}
            {step === "crosswalk" && "Select the Shopify value(s) that map to this campaign."}
            {step === "revenue" && (isLinkedIn ? "Choose whether Shopify should drive Revenue-to-date or Conversion Value for LinkedIn financial metrics." : "Choose what revenue field MetricMind should sum from matched orders.")}
            {step === "review" && "Confirm your selections and process revenue metrics."}
            {step === "complete" &&
              (isLinkedIn
                ? (valueSource === "conversion_value"
                    ? "Conversion value is saved. LinkedIn revenue metrics should now recompute immediately."
                    : "Revenue is connected. LinkedIn financial metrics should now recompute immediately.")
                : "Revenue metrics processed.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "campaign-field" && (
            <div className="space-y-2">
              {/* Reserve space to avoid layout shift when statusLoading flips */}
              <div className="text-xs text-slate-500 min-h-[16px]">
                {statusLoading ? "Checking Shopify connection…" : "\u00A0"}
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
                <div className="text-sm font-medium">{connected ? "Connected Shopify store" : "Connect Shopify"}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {connected
                    ? "To change stores, update the domain below and click Reconnect."
                    : "Connect your Shopify store via OAuth to import order revenue and map it to this campaign."}
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
                    <Button type="button" variant="outline" onClick={() => void openOAuthWindow()} disabled={isConnecting}>
                      {isConnecting ? "Connecting…" : (connected ? "Reconnect / Change store" : "Connect Shopify")}
                    </Button>
                  </div>
                </div>
                {/* Reserve space to avoid layout shift when connected/shopName arrives */}
                <div className="text-xs text-slate-600 dark:text-slate-400 min-h-[16px]">
                  {connected && shopName ? (
                    <>
                      Connected store: <span className="font-medium">{shopName}</span>
                    </>
                  ) : (
                    "\u00A0"
                  )}
                </div>
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
              <div className="text-xs text-slate-500">
                Shopify doesn’t store LinkedIn campaign ids directly by default—UTMs and discount codes are the most common attribution keys.
              </div>
            </div>
          )}

          {step === "crosswalk" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">
                  Selected: <strong>{selectedValues.length}</strong>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchUniqueValues()} disabled={valuesLoading}>
                  {valuesLoading ? "Refreshing…" : "Refresh values"}
                </Button>
              </div>
              <div className="border rounded p-3 max-h-[280px] overflow-y-auto">
                {valuesLoading ? (
                  <div className="text-sm text-slate-500">Loading values…</div>
                ) : uniqueValues.length === 0 ? (
                  <div className="text-sm text-slate-500">No values found. Try increasing the lookback window.</div>
                ) : (
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
                            <div className="text-xs text-slate-500">{v.count} order(s)</div>
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
              {isLinkedIn && (
                <div className="space-y-2">
                  <Label>Source of truth</Label>
                  <RadioGroup value={valueSource} onValueChange={(v: any) => setValueSource(v)} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <RadioGroupItem id="shop-vs-rev" value="revenue" />
                      <label htmlFor="shop-vs-rev" className="text-sm font-medium leading-none cursor-pointer">
                        Use Revenue (to date) — recommended
                      </label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem id="shop-vs-cv" value="conversion_value" />
                      <label htmlFor="shop-vs-cv" className="text-sm font-medium leading-none cursor-pointer">
                        Use Conversion Value (computed from Shopify revenue) — advanced
                      </label>
                    </div>
                  </RadioGroup>
                  <div className="text-xs text-slate-500">
                    Industry standard is using Shopify revenue as the source of truth. Conversion Value mode computes a per-conversion value from Shopify revenue ÷ LinkedIn conversions.
                  </div>
                </div>
              )}

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

              <div className="space-y-2">
                <Label>Lookback window (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(Math.min(Math.max(parseInt(e.target.value || "90", 10) || 90, 1), 3650))}
                />
                <div className="text-xs text-slate-500">Default: last 90 days.</div>
              </div>

              <div className="space-y-2">
                <Label>Is this revenue already tracked in GA4?</Label>
                <Select value={revenueClassification} onValueChange={(v: any) => setRevenueClassification(v)}>
                  <SelectTrigger>
                    <span>
                      {revenueClassification === "onsite_in_ga4"
                        ? "Yes — it’s onsite revenue (also tracked in GA4)"
                        : "No — it’s offsite revenue (NOT tracked in GA4)"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="onsite_in_ga4">Yes — it’s onsite revenue (also tracked in GA4)</SelectItem>
                    <SelectItem value="offsite_not_in_ga4">No — it’s offsite revenue (NOT tracked in GA4)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-slate-500">
                  If you choose “No”, this revenue can be included in campaign-level total revenue without double counting GA4.
                </div>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-2 text-sm text-slate-700">
              {isLinkedIn && (
                <div>
                  <strong>Source of truth:</strong> {valueSource === "conversion_value" ? "Conversion Value (derived)" : "Revenue (to date)"}
                </div>
              )}
              <div>
                <strong>Attribution key:</strong> {campaignField}
              </div>
              <div>
                <strong>Selected values:</strong> {selectedValues.length}
              </div>
              <div>
                <strong>Revenue metric:</strong> {revenueMetric}
              </div>
              <div>
                <strong>Lookback (days):</strong> {days}
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-3">
              <div className="text-sm text-slate-700">Revenue metrics processed. ROI/ROAS should now be available in Overview.</div>
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
              <Button onClick={() => void handleNext()} disabled={valuesLoading || isSaving}>
                {step === "review" ? (isSaving ? "Processing…" : "Process Revenue Metrics") : "Continue"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



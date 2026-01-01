import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ClipboardCheck, DollarSign, Link2, Target } from "lucide-react";

type Step = "campaign-field" | "crosswalk" | "revenue" | "review" | "complete";
type UniqueValue = { value: string; count: number };

export function ShopifyRevenueWizard(props: {
  campaignId: string;
  onBack?: () => void;
  onClose?: () => void;
  onSuccess?: (result: any) => void;
}) {
  const { campaignId, onBack, onClose, onSuccess } = props;
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("campaign-field");
  const [days, setDays] = useState<number>(90);
  const [campaignField, setCampaignField] = useState<string>("utm_campaign");
  const [revenueMetric, setRevenueMetric] = useState<string>("total_price");
  const [valuesLoading, setValuesLoading] = useState(false);
  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (step !== "crosswalk") return;
    if (uniqueValues.length > 0) return;
    void fetchUniqueValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
            days,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || "Failed to process revenue metrics");
        toast({
          title: "Revenue Metrics Processed",
          description: `Conversion value calculated: $${json?.conversionValue || "0"} per conversion.`,
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
            {step === "campaign-field" && "Choose how MetricMind should attribute Shopify orders to this LinkedIn campaign."}
            {step === "crosswalk" && "Select the Shopify value(s) that map to this campaign."}
            {step === "revenue" && "Choose what revenue field MetricMind should sum from matched orders."}
            {step === "review" && "Confirm your selections and process revenue metrics."}
            {step === "complete" && "Conversion value is saved. Revenue metrics should now be unlocked in Overview."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "campaign-field" && (
            <div className="space-y-2">
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
            </div>
          )}

          {step === "review" && (
            <div className="space-y-2 text-sm text-slate-700">
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



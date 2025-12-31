import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle2, DollarSign, Target, Link2, ClipboardCheck } from "lucide-react";

type SalesforceField = {
  name: string;
  label: string;
  type: string;
};

type UniqueValue = {
  value: string;
  count: number;
};

export function SalesforceRevenueWizard(props: {
  campaignId: string;
  onBack?: () => void;
  onSuccess?: (result: any) => void;
  onClose?: () => void;
}) {
  const { campaignId, onBack, onSuccess, onClose } = props;
  const { toast } = useToast();

  type Step = "connect" | "campaign-field" | "crosswalk" | "revenue" | "review" | "complete";
  const [step, setStep] = useState<Step>("connect");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [fields, setFields] = useState<SalesforceField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [campaignField, setCampaignField] = useState<string>("");
  const [revenueField, setRevenueField] = useState<string>("Amount");
  const [days, setDays] = useState<number>(90);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<any>(null);

  const steps = useMemo(
    () => [
      { id: "connect" as const, label: "Connect", icon: Building2 },
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

  const connectedLabel = useMemo(() => orgName || null, [orgName]);

  const fetchStatus = async () => {
    const resp = await fetch(`/api/salesforce/${campaignId}/status`);
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || "Failed to check Salesforce connection");
    if (json?.connected) {
      setOrgName(json?.orgName || null);
      setOrgId(json?.orgId || null);
      return true;
    }
    return false;
  };

  const fetchFields = async () => {
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const resp = await fetch(`/api/salesforce/${campaignId}/opportunities/fields`);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load Opportunity fields");
      const f = Array.isArray(json?.fields) ? json.fields : [];
      setFields(f);
      if (f.length === 0) {
        setFieldsError("No Opportunity fields were returned. Please try again.");
      }
      return f as SalesforceField[];
    } finally {
      setFieldsLoading(false);
    }
  };

  const fetchUniqueValues = async (fieldName: string) => {
    setValuesLoading(true);
    try {
      const resp = await fetch(
        `/api/salesforce/${campaignId}/opportunities/unique-values?field=${encodeURIComponent(fieldName)}&days=${encodeURIComponent(
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

  const openOAuthWindow = async () => {
    setIsConnecting(true);
    try {
      const resp = await fetch("/api/auth/salesforce/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const text = await resp.text().catch(() => "");
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }
      if (!resp.ok) {
        const msg =
          json?.message ||
          json?.error ||
          (text && text.length < 300 ? text : "") ||
          `Failed to start Salesforce OAuth (HTTP ${resp.status})`;
        throw new Error(msg);
      }
      const authUrl = json?.authUrl;
      if (!authUrl) throw new Error("No auth URL returned");

      const w = window.open(authUrl, "salesforce_oauth", "width=520,height=680");
      if (!w) throw new Error("Popup blocked. Please allow popups and try again.");

      const onMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data: any = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "salesforce_auth_success") {
          window.removeEventListener("message", onMessage);
          await fetchStatus();
          toast({
            title: "Salesforce Connected",
            description: "Now select the Opportunity field used to attribute deals to this campaign.",
          });
          setStep("campaign-field");
        } else if (data.type === "salesforce_auth_error") {
          window.removeEventListener("message", onMessage);
          toast({
            title: "Salesforce Connection Failed",
            description: data.error || "Please try again.",
            variant: "destructive",
          });
        }
      };

      window.addEventListener("message", onMessage);
    } catch (err: any) {
      toast({
        title: "Salesforce Connection Failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const connected = await fetchStatus();
        if (!mounted) return;
        if (connected) setStep("campaign-field");
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [campaignId]);

  useEffect(() => {
    if (step !== "campaign-field" && step !== "revenue") return;
    if (fields.length > 0) return;
    (async () => {
      try {
        await fetchFields();
      } catch (err: any) {
        setFieldsError(err?.message || "Failed to load Opportunity fields.");
        toast({
          title: "Failed to Load Salesforce Fields",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
    })();
  }, [step, fields.length, toast]);

  const campaignFieldLabel = useMemo(() => {
    const f = fields.find((x) => x.name === campaignField);
    return f?.label || campaignField || "Campaign field";
  }, [fields, campaignField]);

  const revenueFieldLabel = useMemo(() => {
    const f = fields.find((x) => x.name === revenueField);
    return f?.label || revenueField || "Revenue field";
  }, [fields, revenueField]);

  const save = async () => {
    setIsSaving(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/salesforce/save-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignField,
          selectedValues,
          revenueField,
          days,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to save mappings");
      setLastSaveResult(json);
      toast({
        title: "Salesforce Mappings Saved",
        description: `Conversion value calculated: $${json?.conversionValue || "0"} per conversion.`,
      });
      onSuccess?.(json);
      setStep("complete");
    } catch (err: any) {
      toast({
        title: "Failed to Save Salesforce Mappings",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === "campaign-field") {
      if (!campaignField) {
        toast({
          title: "Select a field",
          description: "Choose the Opportunity field used to attribute deals to this campaign.",
          variant: "destructive",
        });
        return;
      }
      await fetchUniqueValues(campaignField);
      setStep("crosswalk");
      return;
    }
    if (step === "crosswalk") {
      if (selectedValues.length === 0) {
        toast({
          title: "Select at least one value",
          description: "Pick the Salesforce value(s) that should map to this campaign.",
          variant: "destructive",
        });
        return;
      }
      setStep("revenue");
      return;
    }
    if (step === "revenue") {
      if (!revenueField) {
        toast({
          title: "Select a revenue field",
          description: "Choose the Opportunity field that represents revenue (usually Amount).",
          variant: "destructive",
        });
        return;
      }
      setStep("review");
      return;
    }
    if (step === "review") {
      await save();
    }
  };

  const handleBackStep = () => {
    if (step === "campaign-field") return setStep("connect");
    if (step === "crosswalk") return setStep("campaign-field");
    if (step === "revenue") return setStep("crosswalk");
    if (step === "review") return setStep("revenue");
    if (step === "complete") return setStep("review");
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
            {step === "connect" && (
              <>
                <Building2 className="w-5 h-5 text-blue-600" />
                Connect Salesforce
              </>
            )}
            {step === "campaign-field" && (
              <>
                <Target className="w-5 h-5 text-blue-600" />
                Select Campaign Identifier Field
              </>
            )}
            {step === "crosswalk" && (
              <>
                <Link2 className="w-5 h-5 text-blue-600" />
                Link Campaign to Salesforce Value(s)
              </>
            )}
            {step === "revenue" && (
              <>
                <DollarSign className="w-5 h-5 text-green-600" />
                Select Revenue Field
              </>
            )}
            {step === "review" && (
              <>
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                Save Mappings
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
            {step === "connect" && "Connect Salesforce so MetricMind can read Opportunities and calculate revenue metrics."}
            {step === "campaign-field" &&
              `${connectedLabel ? `Connected: ${connectedLabel}. ` : "Salesforce is connected. "}Select the Opportunity field that identifies which deals belong to this MetricMind campaign.`}
            {step === "crosswalk" &&
              `Select the value(s) from “${campaignFieldLabel}” that should map to this MetricMind campaign.`}
            {step === "revenue" && "Select the Opportunity field that represents revenue (usually Amount)."}
            {step === "review" && ""}
            {step === "complete" && "Conversion value is saved. Revenue metrics should now be unlocked in Overview."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "connect" && (
            <div className="flex items-center gap-3">
              <Button onClick={() => void openOAuthWindow()} disabled={isConnecting}>
                {isConnecting ? "Connecting…" : "Connect Salesforce"}
              </Button>
              {onBack && (
                <Button variant="outline" onClick={onBack} disabled={isConnecting}>
                  Back
                </Button>
              )}
            </div>
          )}

          {step === "campaign-field" && (
            <div className="space-y-2">
              <Label>Opportunity field used to attribute deals to this campaign</Label>
              <div className="text-xs text-slate-500">
                Tip: this is usually a field like <strong>LinkedIn Campaign</strong> / <strong>UTM Campaign</strong>.{" "}
                <strong>Opportunity Name</strong> can work only if your opportunity naming convention contains the campaign value you want to map.
              </div>
              <Select value={campaignField} onValueChange={(v) => setCampaignField(v)} disabled={fieldsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={fieldsLoading ? "Loading fields…" : "Select an Opportunity field…"} />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  {fields
                    .slice()
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.label} ({f.name})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {fieldsError && (
                <div className="text-sm text-red-600">
                  {fieldsError}{" "}
                  <button
                    className="underline"
                    onClick={() => {
                      void fetchFields();
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {!fieldsError && fields.length === 0 && !fieldsLoading && (
                <div className="text-sm text-slate-500">No fields loaded yet. Click retry if this persists.</div>
              )}
            </div>
          )}

          {step === "crosswalk" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">
                  Selected: <strong>{selectedValues.length}</strong>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchUniqueValues(campaignField)} disabled={valuesLoading}>
                  {valuesLoading ? "Refreshing…" : "Refresh values"}
                </Button>
              </div>
              <div className="border rounded p-3 max-h-[280px] overflow-y-auto">
                {valuesLoading ? (
                  <div className="text-sm text-slate-500">Loading values…</div>
                ) : uniqueValues.length === 0 ? (
                  <div className="text-sm text-slate-500">No values found. Try adjusting Advanced settings.</div>
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
                            <div className="text-xs text-slate-500">{v.count} opportunity(ies)</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500">Default filter: Closed Won opportunities within the last {days} days.</div>
            </div>
          )}

          {step === "revenue" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Revenue field</Label>
                <Select value={revenueField} onValueChange={(v) => setRevenueField(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {fields
                      .filter((f) => f.type === "currency" || f.type === "double" || f.type === "int" || f.name === "Amount")
                      .map((f) => (
                        <SelectItem key={f.name} value={f.name}>
                          {f.label} ({f.name})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-slate-500">Default: Amount.</div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Currency default: one currency per campaign. If mixed currencies are detected, you’ll be asked to filter to one.
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Hide advanced" : "Advanced"}
                </Button>
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded p-3">
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
            </div>
          )}

          {step === "review" && <div />}

          {step === "complete" && (
            <div className="space-y-3">
              <div className="text-sm text-slate-700">
                Saved conversion value: <strong>${String(lastSaveResult?.conversionValue ?? "0")}</strong> per conversion.
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => onClose?.()}>Back to Campaign Overview</Button>
                <Button variant="outline" onClick={() => setStep("review")}>
                  View settings
                </Button>
              </div>
            </div>
          )}

          {step !== "connect" && step !== "complete" && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleBackStep} disabled={valuesLoading || isSaving}>
                Back
              </Button>
              <Button
                onClick={() => void handleNext()}
                disabled={
                  valuesLoading ||
                  isSaving ||
                  (step === "campaign-field" && (fieldsLoading || fields.length === 0 || !campaignField))
                }
              >
                {step === "review" ? (isSaving ? "Saving…" : "Save Mappings") : "Continue"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



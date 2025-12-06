"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, CheckCircle2, XCircle, Copy, FlaskConical } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WebhookTesterProps {
  campaignId: string;
  campaignName?: string;
}

export function WebhookTester({ campaignId, campaignName }: WebhookTesterProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [value, setValue] = useState("29.99");
  const [currency, setCurrency] = useState("USD");
  const [conversionId, setConversionId] = useState("");
  const [conversionType, setConversionType] = useState("purchase");
  const [occurredAt, setOccurredAt] = useState("");
  const [metadata, setMetadata] = useState("");

  const handleTest = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Build request body
      const body: any = {
        value: parseFloat(value),
        currency: currency || "USD",
      };

      if (conversionId) body.conversionId = conversionId;
      if (conversionType) body.conversionType = conversionType;
      if (occurredAt) body.occurredAt = occurredAt;
      if (metadata) {
        try {
          body.metadata = JSON.parse(metadata);
        } catch (e) {
          throw new Error("Invalid JSON in metadata field");
        }
      }

      // Send webhook request
      const result = await apiRequest(`/api/webhook/conversion/${campaignId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      setResponse(result);
      toast({
        title: "Webhook Test Successful!",
        description: `Conversion event recorded: $${result.event?.value || value} ${result.event?.currency || currency}`,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send webhook request";
      setError(errorMessage);
      toast({
        title: "Webhook Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhook/conversion/${campaignId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Webhook URL Copied!",
      description: "The webhook URL has been copied to your clipboard.",
    });
  };

  const handleQuickFill = (type: "purchase" | "lead" | "signup") => {
    switch (type) {
      case "purchase":
        setValue("149.99");
        setCurrency("USD");
        setConversionType("purchase");
        setConversionId(`order-${Date.now()}`);
        setMetadata(JSON.stringify({ orderId: `order-${Date.now()}`, items: 2 }, null, 2));
        break;
      case "lead":
        setValue("50.00");
        setCurrency("USD");
        setConversionType("lead");
        setConversionId(`lead-${Date.now()}`);
        setMetadata(JSON.stringify({ leadSource: "contact-form", leadScore: 85 }, null, 2));
        break;
      case "signup":
        setValue("99.00");
        setCurrency("USD");
        setConversionType("signup");
        setConversionId(`subscription-${Date.now()}`);
        setMetadata(JSON.stringify({ plan: "pro", billingCycle: "monthly" }, null, 2));
        break;
    }
    setOccurredAt(new Date().toISOString());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" />
            Test Conversion Webhook
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Send test conversion events to verify webhook integration
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <FlaskConical className="w-3 h-3" />
          Test Mode
        </Badge>
      </div>

      {/* Webhook URL Display */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600" />
            Webhook URL (For External Systems)
          </CardTitle>
          <CardDescription>
            <strong>In production:</strong> Give this URL to external systems (Shopify, WooCommerce, Stripe, etc.) 
            so they can automatically send conversion events when sales happen.
            <br />
            <strong>For testing:</strong> You can ignore this - just use the form below to simulate conversions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              value={`${window.location.origin}/api/webhook/conversion/${campaignId}`}
              readOnly
              className="font-mono text-sm bg-white dark:bg-slate-800"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyWebhookUrl}
              className="flex-shrink-0"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy URL
            </Button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
            💡 Copy this URL when you're ready to connect real systems (Shopify, WooCommerce, etc.)
          </p>
        </CardContent>
      </Card>

      {/* Quick Fill Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickFill("purchase")}
          className="flex-1"
        >
          Quick Fill: Purchase
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickFill("lead")}
          className="flex-1"
        >
          Quick Fill: Lead
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickFill("signup")}
          className="flex-1"
        >
          Quick Fill: Signup
        </Button>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Test Conversion Event</CardTitle>
          <CardDescription>
            <strong>What this does:</strong> Simulates what an external system (like Shopify) would send when a conversion happens.
            <br />
            <strong>Example:</strong> Customer buys a $149.99 product → Shopify sends {"{"}"value": 149.99{"}"} → MetricMind records it.
            <br />
            <strong>You're doing:</strong> Manually entering the data that would normally be sent automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">
                Value * <span className="text-xs text-slate-500">(Required)</span>
              </Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="29.99"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="conversionId">Conversion ID</Label>
              <Input
                id="conversionId"
                value={conversionId}
                onChange={(e) => setConversionId(e.target.value)}
                placeholder="order-123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversionType">Conversion Type</Label>
              <Select value={conversionType} onValueChange={setConversionType}>
                <SelectTrigger id="conversionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="signup">Signup</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurredAt">Occurred At</Label>
            <Input
              id="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setOccurredAt(date.toISOString());
              }}
            />
            <p className="text-xs text-slate-500">
              Leave empty to use current time
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metadata">Metadata (JSON)</Label>
            <Textarea
              id="metadata"
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder='{"orderId": "123", "customerId": "456"}'
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              Optional: Additional data as JSON object
            </p>
          </div>

          <Button
            onClick={handleTest}
            disabled={isLoading || !value}
            className="w-full"
            size="lg"
          >
            <Send className="w-4 h-4 mr-2" />
            {isLoading ? "Sending..." : "Send Test Webhook"}
          </Button>
        </CardContent>
      </Card>

      {/* Response Display */}
      {response && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Success Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-white dark:bg-slate-800 p-3 rounded border overflow-auto max-h-64">
              {JSON.stringify(response, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="w-4 h-4" />
              Error Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Connection to Conversion Value */}
      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            How This Connects to Conversion Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong className="text-green-900 dark:text-green-200">1. Campaign Settings Field:</strong>
              <p className="text-green-800 dark:text-green-300 mt-1">
                In Campaign Settings, you see a "Conversion Value" field. You can manually enter a value (like $50) 
                as a fallback, but...
              </p>
            </div>
            <div>
              <strong className="text-green-900 dark:text-green-200">2. Webhook Updates It Automatically:</strong>
              <p className="text-green-800 dark:text-green-300 mt-1">
                When you send webhook events (or real systems send them), MetricMind automatically calculates the 
                <strong> average conversion value</strong> from recent events and <strong>updates the Campaign Settings field</strong>.
              </p>
            </div>
            <div>
              <strong className="text-green-900 dark:text-green-200">3. Revenue Uses Actual Values:</strong>
              <p className="text-green-800 dark:text-green-300 mt-1">
                Revenue calculations (ROI, ROAS, Total Revenue) use the <strong>actual values from webhook events</strong>, 
                not the fixed conversion value. This is much more accurate!
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded border border-green-200 dark:border-green-700 mt-3">
              <p className="text-xs font-mono text-green-900 dark:text-green-100">
                <strong>Example:</strong> You send events: $29.99, $149.99, $5.00<br />
                → Campaign's "Conversion Value" auto-updates to: $61.66 (average)<br />
                → Revenue calculation uses: $29.99 + $149.99 + $5.00 = $184.98 (actual sum)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <FlaskConical className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                How This Works in Real Life
              </h4>
              <div className="space-y-2 text-xs text-amber-800 dark:text-amber-300">
                <p>
                  <strong>1. In Production:</strong> External systems (Shopify, WooCommerce, Stripe) automatically send 
                  conversion events to the webhook URL when sales happen. No manual work needed!
                </p>
                <p>
                  <strong>2. What You're Testing:</strong> You're manually simulating what those external systems would do. 
                  This lets you verify the webhook works before connecting real systems.
                </p>
                <p>
                  <strong>3. Result:</strong> When you send a test event, MetricMind stores it just like a real conversion. 
                  The campaign's average conversion value is automatically updated, and revenue metrics use the actual values.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


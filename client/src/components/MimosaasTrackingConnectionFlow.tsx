import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WebsiteConnection = {
  id: string;
  websiteUrl: string;
  installationStatus: string;
};

type Props = {
  campaignId: string;
  websiteUrl: string;
  onVerified: (connectionId: string) => void;
};

const normalizeOrigin = (value: string) => new URL(value).origin;

export function MimosaasTrackingConnectionFlow({ campaignId, websiteUrl, onVerified }: Props) {
  const { toast } = useToast();
  const [connection, setConnection] = useState<WebsiteConnection | null>(null);
  const [trackingId, setTrackingId] = useState("");
  const [trackingSecret, setTrackingSecret] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const notifiedConnectionRef = useRef<string | null>(null);
  const websiteOrigin = useMemo(() => {
    try { return normalizeOrigin(websiteUrl); } catch { return ""; }
  }, [websiteUrl]);

  const notifyVerified = (verifiedConnection: WebsiteConnection) => {
    if (notifiedConnectionRef.current === verifiedConnection.id) return;
    notifiedConnectionRef.current = verifiedConnection.id;
    onVerified(verifiedConnection.id);
  };

  const readMatchingConnection = async () => {
    const response = await apiRequest("GET", `/api/campaigns/${campaignId}/mimosaas-tracking/websites`);
    const body = await response.json();
    const matching = (Array.isArray(body?.connections) ? body.connections : [])
      .find((candidate: WebsiteConnection) => candidate.websiteUrl === websiteOrigin) || null;
    setConnection(matching);
    if (matching?.installationStatus === "verified") notifyVerified(matching);
    return matching as WebsiteConnection | null;
  };

  useEffect(() => {
    if (!campaignId || !websiteOrigin) return;
    void readMatchingConnection().catch((error: any) => {
      toast({ title: "Unable to check website", description: error?.message || "Try again.", variant: "destructive" });
    });
  }, [campaignId, websiteOrigin]);

  useEffect(() => {
    if (!connection || connection.installationStatus === "verified") return;
    const timer = window.setInterval(() => {
      setIsChecking(true);
      void readMatchingConnection()
        .catch(() => undefined)
        .finally(() => setIsChecking(false));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [connection?.id, connection?.installationStatus]);

  const prepareInstallation = async () => {
    if (!websiteOrigin) {
      toast({ title: "Website required", description: "Enter a valid website in Campaign Details.", variant: "destructive" });
      return;
    }
    setIsPreparing(true);
    try {
      const existing = connection || await readMatchingConnection();
      if (existing?.installationStatus === "verified") {
        notifyVerified(existing);
        return;
      }
      const response = existing
        ? await apiRequest("POST", `/api/campaigns/${campaignId}/mimosaas-tracking/websites/${existing.id}/rotate-secret`)
        : await apiRequest("POST", `/api/campaigns/${campaignId}/mimosaas-tracking/websites`, {
            websiteUrl: websiteOrigin,
            installationMethod: "universal",
          });
      const body = await response.json();
      setConnection(body.connection);
      setTrackingId(String(body?.credentials?.trackingId || ""));
      setTrackingSecret(String(body?.credentials?.secret || ""));
    } catch (error: any) {
      toast({ title: "Website setup failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setIsPreparing(false);
    }
  };

  const installationCode = trackingId && trackingSecret
    ? `<script async src="${window.location.origin}/api/mimosaas-tracking/tracker.js" data-tracking-id="${trackingId}" data-tracking-secret="${trackingSecret}"></script>`
    : "";

  if (connection?.installationStatus === "verified") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle className="h-4 w-4" /> Website connected
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium">Website</div>
        <div className="text-sm text-muted-foreground break-all">{websiteOrigin || "No valid website entered"}</div>
      </div>
      {!installationCode ? (
        <Button type="button" className="w-full" onClick={prepareInstallation} disabled={isPreparing || !websiteOrigin}>
          {isPreparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {connection ? "Generate new installation code" : "Generate installation code"}
        </Button>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Add this code once before the closing &lt;/head&gt; tag on the website. Verification runs automatically.</p>
          <pre className="overflow-x-auto rounded-md border bg-background p-3 text-xs whitespace-pre-wrap break-all">{installationCode}</pre>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              await navigator.clipboard.writeText(installationCode);
              toast({ title: "Copied", description: "Installation code copied." });
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy installation code
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} /> Waiting for website verification
          </div>
        </>
      )}
    </div>
  );
}

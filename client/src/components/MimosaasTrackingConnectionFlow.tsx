import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WebsiteConnection = {
  id: string;
  websiteUrl: string;
  installationMethod: string;
  installationStatus: string;
};

type GtmContainer = {
  path: string;
  name: string;
  publicId: string;
  domainNames: string[];
  recommended: boolean;
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
  const [gtmAvailable, setGtmAvailable] = useState(false);
  const [installationMode, setInstallationMode] = useState<"recommended" | "gtm" | "universal">("recommended");
  const [gtmAuthorization, setGtmAuthorization] = useState<unknown>(null);
  const [gtmContainers, setGtmContainers] = useState<GtmContainer[]>([]);
  const [isInstallingGtm, setIsInstallingGtm] = useState(false);
  const [gtmPublished, setGtmPublished] = useState(false);
  const notifiedConnectionRef = useRef<string | null>(null);
  const trackingSecretRef = useRef("");
  const gtmInstallStartedRef = useRef(false);
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
    return matching as WebsiteConnection | null;
  };

  useEffect(() => {
    if (!campaignId || !websiteOrigin) return;
    setInstallationMode("recommended");
    setGtmAuthorization(null);
    setGtmContainers([]);
    setGtmPublished(false);
    setTrackingId("");
    setTrackingSecret("");
    trackingSecretRef.current = "";
    gtmInstallStartedRef.current = false;
    void readMatchingConnection().catch((error: any) => {
      toast({ title: "Unable to check website", description: error?.message || "Try again.", variant: "destructive" });
    });
  }, [campaignId, websiteOrigin]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void apiRequest("GET", `/api/campaigns/${campaignId}/mimosaas-tracking/gtm/availability`)
      .then((response) => response.json())
      .then((body) => { if (active) setGtmAvailable(body?.enabled === true); })
      .catch(() => { if (active) setGtmAvailable(false); });
    return () => { active = false; };
  }, [campaignId]);

  useEffect(() => {
    const handleGtmMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data || {};
      if (message.type === "mimosaas_gtm_auth_error" && message.campaignId === campaignId && message.connectionId === connection?.id) {
        setInstallationMode("universal");
        toast({ title: "Google Tag Manager connection failed", description: message.error || "Use the installation code instead.", variant: "destructive" });
        return;
      }
      if (
        message.type !== "mimosaas_gtm_auth_success" ||
        message.campaignId !== campaignId ||
        message.connectionId !== connection?.id ||
        !message.authorization ||
        !Array.isArray(message.containers)
      ) return;
      gtmInstallStartedRef.current = false;
      setGtmAuthorization(message.authorization);
      setGtmContainers(message.containers);
    };
    window.addEventListener("message", handleGtmMessage);
    return () => window.removeEventListener("message", handleGtmMessage);
  }, [campaignId, connection?.id, toast]);

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

  const prepareCredentials = async (installationMethod: "google_tag_manager" | "universal") => {
    if (!websiteOrigin) {
      toast({ title: "Website required", description: "Enter a valid website in Campaign Details.", variant: "destructive" });
      return null;
    }
    const existing = connection || await readMatchingConnection();
    if (existing?.installationStatus === "verified") {
      notifyVerified(existing);
      return null;
    }
    const response = existing
      ? await apiRequest("POST", `/api/campaigns/${campaignId}/mimosaas-tracking/websites/${existing.id}/rotate-secret`)
      : await apiRequest("POST", `/api/campaigns/${campaignId}/mimosaas-tracking/websites`, {
          websiteUrl: websiteOrigin,
          installationMethod,
        });
    const body = await response.json();
    const secret = String(body?.credentials?.secret || "");
    setConnection(body.connection);
    setTrackingId(String(body?.credentials?.trackingId || ""));
    setTrackingSecret(secret);
    trackingSecretRef.current = secret;
    return { connection: body.connection as WebsiteConnection, trackingSecret: secret };
  };

  const prepareUniversalInstallation = async () => {
    setIsPreparing(true);
    setInstallationMode("universal");
    try {
      await prepareCredentials("universal");
    } catch (error: any) {
      toast({ title: "Website setup failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setIsPreparing(false);
    }
  };

  const startGtmInstallation = async () => {
    const popup = window.open("", "mimosaas_gtm_oauth", "width=520,height=700,scrollbars=yes,resizable=yes");
    if (!popup) {
      toast({ title: "Popup blocked", description: "Allow popups and try again.", variant: "destructive" });
      return;
    }
    setIsPreparing(true);
    setInstallationMode("gtm");
    setGtmPublished(false);
    gtmInstallStartedRef.current = false;
    try {
      const credentials = await prepareCredentials("google_tag_manager");
      if (!credentials) { popup.close(); return; }
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/mimosaas-tracking/gtm/connect`, {
        connectionId: credentials.connection.id,
      });
      const body = await response.json();
      if (!body?.authUrl) throw new Error("Google Tag Manager connection could not start");
      popup.location.href = body.authUrl;
    } catch (error: any) {
      popup.close();
      setInstallationMode("universal");
      toast({ title: "Website setup failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setIsPreparing(false);
    }
  };

  const installGtmContainer = async (container: GtmContainer) => {
    if (!connection || !gtmAuthorization || !trackingSecretRef.current || gtmInstallStartedRef.current) return;
    gtmInstallStartedRef.current = true;
    const authorization = gtmAuthorization;
    setGtmAuthorization(null);
    setGtmContainers([]);
    setIsInstallingGtm(true);
    try {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/mimosaas-tracking/gtm/install`, {
        connectionId: connection.id,
        trackingSecret: trackingSecretRef.current,
        containerPath: container.path,
        authorization,
      });
      const body = await response.json();
      setConnection(body.connection);
      setGtmContainers([]);
      setGtmAuthorization(null);
      setGtmPublished(true);
      toast({ title: "Tracker published", description: "Waiting for the website to confirm the installation." });
    } catch (error: any) {
      toast({ title: "Google Tag Manager installation failed", description: error?.message || "Try again.", variant: "destructive" });
      setInstallationMode("universal");
    } finally {
      setIsInstallingGtm(false);
    }
  };

  useEffect(() => {
    if (!gtmAuthorization || isInstallingGtm) return;
    const recommended = gtmContainers.filter((container) => container.recommended);
    if (recommended.length === 1) void installGtmContainer(recommended[0]);
  }, [gtmAuthorization, gtmContainers, isInstallingGtm]);

  const installationCode = trackingId && trackingSecret
    ? `<script async src="${window.location.origin}/api/mimosaas-tracking/tracker.js" data-tracking-id="${trackingId}" data-tracking-secret="${trackingSecret}"></script>`
    : "";

  if (connection?.installationStatus === "verified") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" /> A verified tracker is already installed on this website
        </div>
        <Button type="button" className="w-full" onClick={() => notifyVerified(connection)}>
          Continue with existing tracker
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium">Website</div>
        <div className="text-sm text-muted-foreground break-all">{websiteOrigin || "No valid website entered"}</div>
      </div>
      {installationMode === "recommended" && (
        <>
          {gtmAvailable && <p className="text-sm text-muted-foreground">Choose Google Tag Manager only if it is already installed on this website.</p>}
          {gtmAvailable && (
            <Button type="button" variant="outline" className="w-full" onClick={startGtmInstallation} disabled={isPreparing || !websiteOrigin}>
              {isPreparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Use Google Tag Manager
            </Button>
          )}
          <Button type="button" variant={gtmAvailable ? "outline" : "default"} className="w-full" onClick={prepareUniversalInstallation} disabled={isPreparing || !websiteOrigin}>
            {isPreparing && !gtmAvailable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Use installation code
          </Button>
        </>
      )}
      {installationMode === "gtm" && (
        <>
          {isPreparing && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening Google sign-in</div>}
          {isInstallingGtm && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Publishing the Mimosaas tag</div>}
          {gtmAuthorization && gtmContainers.filter((container) => container.recommended).length !== 1 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Choose the Google Tag Manager container used by this website.</p>
              {gtmContainers.map((container) => (
                <Button key={container.path} type="button" variant="outline" className="w-full justify-start" onClick={() => installGtmContainer(container)}>
                  {container.name} ({container.publicId})
                </Button>
              ))}
            </div>
          )}
          {!isPreparing && !isInstallingGtm && !gtmAuthorization && !gtmPublished && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Complete Google sign-in</div>
          )}
          {gtmPublished && (
            <>
              <iframe
                src={websiteOrigin}
                title="Mimosaas automatic website verification"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                sandbox="allow-scripts allow-same-origin"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} /> Verifying website automatically</div>
            </>
          )}
          {!gtmPublished && !isInstallingGtm && (
            <Button type="button" variant="link" className="w-full" onClick={prepareUniversalInstallation} disabled={isPreparing}>
              Use installation code instead
            </Button>
          )}
        </>
      )}
      {installationMode === "universal" && (!installationCode ? (
        <Button type="button" className="w-full" onClick={prepareUniversalInstallation} disabled={isPreparing || !websiteOrigin}>
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
      ))}
    </div>
  );
}

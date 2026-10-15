import { GoogleAdsClient } from "./googleAdsClient";
import { storage, type IStorage, type MimosaasTrackingGclidMatch } from "./storage";

type GoogleAdsLookupClient = Pick<GoogleAdsClient, "getCustomerAccount" | "getClickCampaign">;
type ResolverStore = Pick<IStorage,
  "getMimosaasTrackingGclidAttributionContext" |
  "getGoogleAdsConnection" |
  "updateGoogleAdsConnection" |
  "deferMimosaasTrackingGclidAttribution" |
  "resolveMimosaasTrackingGclidAttribution"
>;

type ResolverDependencies = {
  now: () => Date;
  refreshAccessToken: typeof GoogleAdsClient.refreshAccessToken;
  createClient: (params: ConstructorParameters<typeof GoogleAdsClient>[0]) => GoogleAdsLookupClient;
};

const defaults: ResolverDependencies = {
  now: () => new Date(),
  refreshAccessToken: GoogleAdsClient.refreshAccessToken,
  createClient: (params) => new GoogleAdsClient(params),
};

const dateInTimeZone = (date: Date, timeZone: string): string => {
  const normalized = String(timeZone || "").trim();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: normalized,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (!byType.year || !byType.month || !byType.day) throw new Error("missing date parts");
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    throw new Error("Google Ads account timezone is unavailable");
  }
};

const parseCampaignScope = (value: unknown): string[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value || "[]"));
  } catch {
    throw new Error("Google Ads selected campaign scope is invalid");
  }
  if (!Array.isArray(parsed)) throw new Error("Google Ads selected campaign scope is invalid");
  const ids = Array.from(new Set(parsed.map((id) => String(id || "").trim()).filter(Boolean)));
  if (ids.length === 0 || ids.some((id) => !/^\d+$/.test(id))) throw new Error("Google Ads selected campaign scope is invalid");
  return ids;
};

export async function resolveMimosaasTrackingGclidEvent(
  websiteConnectionId: string,
  eventId: string,
  store: ResolverStore = storage,
  dependencies: ResolverDependencies = defaults,
) {
  const context = await store.getMimosaasTrackingGclidAttributionContext(websiteConnectionId, eventId);
  const gclid = String(context.gclid || "").trim();
  if (!gclid) throw new Error("Mimosaas Tracking Google Ads click ID is unavailable");
  const eventTime = context.eventTime instanceof Date ? context.eventTime : new Date(context.eventTime);
  if (Number.isNaN(eventTime.getTime())) throw new Error("Mimosaas Tracking event time is invalid");
  const matches: MimosaasTrackingGclidMatch[] = [];

  for (const campaignId of context.candidateCampaignIds) {
    const connection = await store.getGoogleAdsConnection(campaignId);
    if (!connection || connection.method !== "oauth" || connection.spendOnly === true) continue;
    const selectedCampaignIds = parseCampaignScope(connection.selectedCampaignIds);
    const clientId = String(connection.clientId || process.env.GOOGLE_ADS_CLIENT_ID || "").trim();
    const clientSecret = String(connection.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET || "").trim();
    const refreshToken = String(connection.refreshToken || "").trim();
    const developerToken = String(connection.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
    let accessToken = String(connection.accessToken || "").trim();
    const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : Number.POSITIVE_INFINITY;
    if ((!accessToken || expiresAt <= dependencies.now().getTime() + 60_000) && refreshToken && clientId && clientSecret) {
      const refreshed = await dependencies.refreshAccessToken(refreshToken, clientId, clientSecret);
      accessToken = String(refreshed.access_token || "").trim();
      const updated = await store.updateGoogleAdsConnection(campaignId, {
        accessToken,
        expiresAt: new Date(dependencies.now().getTime() + refreshed.expires_in * 1000),
      } as any);
      if (!updated) throw new Error("Google Ads connection changed during token refresh");
    }
    if (!accessToken || !developerToken || !connection.customerId) throw new Error("Google Ads lookup credentials are unavailable");
    const client = dependencies.createClient({
      accessToken,
      developerToken,
      customerId: connection.customerId,
      managerAccountId: connection.managerAccountId || undefined,
    });
    const account = await client.getCustomerAccount();
    if (account.manager) throw new Error("Google Ads click lookup requires a non-manager customer account");
    const click = await client.getClickCampaign(gclid, dateInTimeZone(eventTime, account.timeZone), selectedCampaignIds);
    if (click) matches.push({ campaignId, externalCampaignId: click.campaignId });
  }

  if (matches.length === 0) {
    const attribution = await store.deferMimosaasTrackingGclidAttribution(websiteConnectionId, eventId, gclid);
    return { status: attribution.status, attribution };
  }
  const attribution = await store.resolveMimosaasTrackingGclidAttribution(
    websiteConnectionId,
    eventId,
    gclid,
    matches,
  );
  return { status: attribution.status, attribution };
}

import { createHash } from "crypto";
import { JWT } from "google-auth-library";
import type { GoogleAdsClientServiceAccount } from "@shared/schema";
import { clientAccountConfig, clientAccountRequest } from "./ga4-service-account";

export const GOOGLE_ADS_SERVICE_ACCOUNT_METHOD = "service_account";

type GoogleAdsServiceAccountConfig = {
  email: string;
  privateKey: string;
  allowedCustomerIds: Set<string>;
  loginCustomerId: string | null;
  fingerprint: string;
};

let cachedAccessToken: { fingerprint: string; token: string; expiresAt: number } | null = null;

export const normalizeGoogleAdsCustomerId = (value: unknown): string =>
  String(value || "").trim().replace(/-/g, "");

export const isSupportedGoogleAdsSpendConnectionMethod = (method: unknown): boolean => {
  const normalized = String(method || "").trim().toLowerCase();
  return normalized === "oauth" || normalized === GOOGLE_ADS_SERVICE_ACCOUNT_METHOD;
};

export function getGoogleAdsServiceAccountConfig(): GoogleAdsServiceAccountConfig | null {
  const raw = String(process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON || process.env.GA4_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Google Ads service-account JSON is invalid"), { code: "GOOGLE_ADS_SERVICE_ACCOUNT_CONFIG_INVALID" });
  }

  const email = String(parsed?.client_email || "").trim();
  const privateKey = String(parsed?.private_key || "").replace(/\\n/g, "\n").trim();
  if (parsed?.type !== "service_account" || !email || !privateKey) {
    throw Object.assign(new Error("Google Ads service-account JSON is invalid or missing required credentials"), { code: "GOOGLE_ADS_SERVICE_ACCOUNT_CONFIG_INVALID" });
  }

  const allowedCustomerIds = new Set(
    String(process.env.GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS || "")
      .split(",")
      .map(normalizeGoogleAdsCustomerId)
      .filter((customerId) => /^\d{10}$/.test(customerId)),
  );
  const configuredLoginCustomerId = normalizeGoogleAdsCustomerId(process.env.GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID);
  const loginCustomerId = /^\d{10}$/.test(configuredLoginCustomerId) ? configuredLoginCustomerId : null;

  return {
    email,
    privateKey,
    allowedCustomerIds,
    loginCustomerId,
    fingerprint: createHash("sha256").update(`${email}\n${privateKey}`).digest("hex"),
  };
}

export function getGoogleAdsServiceAccountPublicStatus(): { enabled: boolean; email: string | null; selfService?: boolean } {
  if (isGoogleAdsClientServiceAccountSetupEnabled()) return { enabled: true, email: null, selfService: true };
  const config = getGoogleAdsServiceAccountConfig();
  return { enabled: Boolean(config && config.allowedCustomerIds.size > 0), email: config?.email || null };
}

export function assertGoogleAdsServiceAccountCustomerAllowed(customerId: unknown): string {
  const normalized = normalizeGoogleAdsCustomerId(customerId);
  if (!/^\d{10}$/.test(normalized)) {
    throw Object.assign(new Error("Enter a valid 10-digit Google Ads Customer ID"), { code: "GOOGLE_ADS_CUSTOMER_ID_INVALID" });
  }
  const config = getGoogleAdsServiceAccountConfig();
  if (!config || config.allowedCustomerIds.size === 0) {
    throw Object.assign(new Error("Temporary Google Ads service-account access is not configured"), { code: "GOOGLE_ADS_SERVICE_ACCOUNT_NOT_CONFIGURED" });
  }
  if (!config.allowedCustomerIds.has(normalized)) {
    throw Object.assign(new Error("This Google Ads customer is not approved for temporary service-account access"), { code: "GOOGLE_ADS_SERVICE_ACCOUNT_CUSTOMER_NOT_ALLOWED" });
  }
  return normalized;
}

export function getGoogleAdsServiceAccountLoginCustomerId(): string | null {
  return getGoogleAdsServiceAccountConfig()?.loginCustomerId || null;
}

export async function getGoogleAdsServiceAccountAccessToken(): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = getGoogleAdsServiceAccountConfig();
  if (!config) {
    throw Object.assign(new Error("Temporary Google Ads service-account access is not configured"), { code: "GOOGLE_ADS_SERVICE_ACCOUNT_NOT_CONFIGURED" });
  }
  if (cachedAccessToken && cachedAccessToken.fingerprint === config.fingerprint && cachedAccessToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { accessToken: cachedAccessToken.token, expiresAt: new Date(cachedAccessToken.expiresAt) };
  }

  const client = new JWT({
    email: config.email,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/adwords"],
  });
  const credentials = await client.authorize();
  const token = String(credentials.access_token || "").trim();
  if (!token) throw Object.assign(new Error("Google did not issue a Google Ads service-account access token"), { code: "GOOGLE_ADS_SERVICE_ACCOUNT_TOKEN_FAILED" });
  const expiresAt = Number(credentials.expiry_date) || Date.now() + 55 * 60 * 1000;
  cachedAccessToken = { fingerprint: config.fingerprint, token, expiresAt };
  return { accessToken: token, expiresAt: new Date(expiresAt) };
}

export async function hydrateGoogleAdsServiceAccountConnection<T extends Record<string, any>>(connection: T): Promise<T> {
  if (String(connection?.method || "").trim().toLowerCase() !== GOOGLE_ADS_SERVICE_ACCOUNT_METHOD) return connection;
  const { storage } = await import("../storage");
  let credentials: { accessToken: string; expiresAt: Date };
  if (connection.serviceAccountBindingId) {
    const binding = await storage.getGoogleAdsClientServiceAccount(connection.campaignId, normalizeGoogleAdsCustomerId(connection.customerId), connection.serviceAccountBindingId);
    if (!binding?.verifiedAt || !binding.googleUniqueId) throw new Error("This client's Google Ads access is not verified.");
    credentials = await getGoogleAdsClientServiceAccountAccessToken(binding);
  } else {
    assertGoogleAdsServiceAccountCustomerAllowed(connection?.customerId);
    await storage.assertServiceAccountResourceAccess(connection.campaignId, "google_ads", normalizeGoogleAdsCustomerId(connection.customerId));
    credentials = await getGoogleAdsServiceAccountAccessToken();
  }
  return {
    ...connection,
    managerAccountId: connection.serviceAccountBindingId ? null : connection?.managerAccountId || getGoogleAdsServiceAccountLoginCustomerId(),
    accessToken: credentials.accessToken,
    refreshToken: null,
    clientId: null,
    clientSecret: null,
    developerToken: null,
    expiresAt: credentials.expiresAt,
  };
}

export function isGoogleAdsClientServiceAccountSetupEnabled(): boolean {
  if (process.env.GOOGLE_ADS_CLIENT_SERVICE_ACCOUNTS_ENABLED !== "true") return false;
  clientAccountConfig();
  return true;
}

export function getGoogleAdsClientServiceAccountEmail(clientName: string, customer: unknown): string {
  const customerId = normalizeGoogleAdsCustomerId(customer);
  if (!/^\d{10}$/.test(customerId)) throw Object.assign(new Error("Enter a valid 10-digit Google Ads Customer ID"), { status: 400 });
  let name = clientName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
  if (!/^[a-z]/.test(name)) name = `client-${name}`;
  return `${name.slice(0, 15).replace(/-+$/g, "")}-ads-${customerId}@${clientAccountConfig().projectId}.iam.gserviceaccount.com`;
}

export async function provisionGoogleAdsClientServiceAccount(binding: GoogleAdsClientServiceAccount): Promise<string> {
  if (!isGoogleAdsClientServiceAccountSetupEnabled()) throw new Error("Automatic Google Ads setup is not enabled.");
  const config = clientAccountConfig(), suffix = `@${config.projectId}.iam.gserviceaccount.com`;
  if (!binding.email.endsWith(suffix)) throw new Error("This access email belongs to a different Google project.");
  const base = `https://iam.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/serviceAccounts`;
  const url = `${base}/${encodeURIComponent(binding.email)}`, description = `mimosaas-ads-client-binding:${binding.id}`;
  let response = await clientAccountRequest(url);
  if (response.status === 404 && !binding.googleUniqueId) {
    await response.body?.cancel();
    response = await clientAccountRequest(base, { accountId: binding.email.slice(0, -suffix.length), serviceAccount: { displayName: binding.email.split("@")[0], description } });
    if (response.status === 409) { await response.body?.cancel(); response = await clientAccountRequest(url); }
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error("Google could not prepare the access email. Please retry or contact support."); }
  const account = await response.json();
  if (account.email !== binding.email || account.projectId !== config.projectId || account.description !== description || account.disabled === true ||
    typeof account.uniqueId !== "string" || !/^\d+$/.test(account.uniqueId) || (binding.googleUniqueId && binding.googleUniqueId !== account.uniqueId)) {
    throw new Error("This access email is unavailable. No existing account has been changed.");
  }
  return account.uniqueId;
}

const clientTokens = new Map<string, { accessToken: string; expiresAt: Date }>();
export async function getGoogleAdsClientServiceAccountAccessToken(binding: GoogleAdsClientServiceAccount): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = clientAccountConfig();
  if (!/^\d+$/.test(binding.googleUniqueId || "") || !binding.email.endsWith(`@${config.projectId}.iam.gserviceaccount.com`)) throw new Error("This client's Google Ads identity is unavailable.");
  const key = createHash("sha256").update(`${config.email}\n${config.key}\n${binding.googleUniqueId}`).digest("hex");
  const cached = clientTokens.get(key);
  if (cached && cached.expiresAt.getTime() > Date.now() + 5 * 60_000) return cached;
  const response = await clientAccountRequest(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${binding.googleUniqueId}:generateAccessToken`, {
    scope: ["https://www.googleapis.com/auth/adwords"], lifetime: "3600s",
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error("Google could not authorise this client's Ads access. Please retry or contact support."); }
  const data = await response.json(), expiresAt = new Date(data.expireTime);
  if (typeof data.accessToken !== "string" || !data.accessToken.trim() || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() + 60_000) throw new Error("Google returned an invalid access credential.");
  const credentials = { accessToken: String(data.accessToken), expiresAt };
  if (clientTokens.size >= 256) clientTokens.delete(clientTokens.keys().next().value!);
  clientTokens.set(key, credentials);
  return credentials;
}

import { createHash } from "crypto";
import { JWT } from "google-auth-library";

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

export function getGoogleAdsServiceAccountPublicStatus(): { enabled: boolean; email: string | null } {
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
  assertGoogleAdsServiceAccountCustomerAllowed(connection?.customerId);
  const credentials = await getGoogleAdsServiceAccountAccessToken();
  return {
    ...connection,
    managerAccountId: connection?.managerAccountId || getGoogleAdsServiceAccountLoginCustomerId(),
    accessToken: credentials.accessToken,
    refreshToken: null,
    clientId: null,
    clientSecret: null,
    developerToken: null,
    expiresAt: credentials.expiresAt,
  };
}

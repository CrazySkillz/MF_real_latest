import { createHash } from "crypto";
import { JWT } from "google-auth-library";

export const GA4_SERVICE_ACCOUNT_METHOD = "service_account";

type GA4ServiceAccountConfig = {
  email: string;
  privateKey: string;
  allowedPropertyIds: Set<string>;
  fingerprint: string;
};

let cachedAccessToken: { fingerprint: string; token: string; expiresAt: number } | null = null;

export const normalizeGA4ServiceAccountPropertyId = (value: unknown): string =>
  String(value || "").trim().replace(/^properties\//i, "");

export const isSupportedGA4ConnectionMethod = (method: unknown): boolean => {
  const normalized = String(method || "").trim().toLowerCase();
  return normalized === "access_token" || normalized === GA4_SERVICE_ACCOUNT_METHOD;
};

export function getGA4ServiceAccountConfig(): GA4ServiceAccountConfig | null {
  const raw = String(process.env.GA4_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("GA4 service-account JSON is invalid"), { code: "GA4_SERVICE_ACCOUNT_CONFIG_INVALID" });
  }

  const email = String(parsed?.client_email || "").trim();
  const privateKey = String(parsed?.private_key || "").replace(/\\n/g, "\n").trim();
  if (parsed?.type !== "service_account" || !email || !privateKey) {
    throw Object.assign(new Error("GA4 service-account JSON is invalid or missing required credentials"), { code: "GA4_SERVICE_ACCOUNT_CONFIG_INVALID" });
  }

  const allowedPropertyIds = new Set(
    String(process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS || "")
      .split(",")
      .map(normalizeGA4ServiceAccountPropertyId)
      .filter((propertyId) => /^\d+$/.test(propertyId)),
  );

  return {
    email,
    privateKey,
    allowedPropertyIds,
    fingerprint: createHash("sha256").update(`${email}\n${privateKey}`).digest("hex"),
  };
}

export function getGA4ServiceAccountPublicStatus(): { enabled: boolean; email: string | null } {
  const config = getGA4ServiceAccountConfig();
  return {
    enabled: Boolean(config && config.allowedPropertyIds.size > 0),
    email: config?.email || null,
  };
}

export function assertGA4ServiceAccountPropertyAllowed(propertyId: unknown): string {
  const normalized = normalizeGA4ServiceAccountPropertyId(propertyId);
  if (!/^\d+$/.test(normalized)) {
    throw Object.assign(new Error("Enter a valid numeric GA4 Property ID"), { code: "GA4_PROPERTY_ID_INVALID" });
  }
  const config = getGA4ServiceAccountConfig();
  if (!config || config.allowedPropertyIds.size === 0) {
    throw Object.assign(new Error("Temporary GA4 service-account access is not configured"), { code: "GA4_SERVICE_ACCOUNT_NOT_CONFIGURED" });
  }
  if (!config.allowedPropertyIds.has(normalized)) {
    throw Object.assign(new Error("This GA4 property is not approved for temporary service-account access"), { code: "GA4_SERVICE_ACCOUNT_PROPERTY_NOT_ALLOWED" });
  }
  return normalized;
}

export async function getGA4ServiceAccountAccessToken(): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = getGA4ServiceAccountConfig();
  if (!config) {
    throw Object.assign(new Error("Temporary GA4 service-account access is not configured"), { code: "GA4_SERVICE_ACCOUNT_NOT_CONFIGURED" });
  }

  if (cachedAccessToken && cachedAccessToken.fingerprint === config.fingerprint && cachedAccessToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { accessToken: cachedAccessToken.token, expiresAt: new Date(cachedAccessToken.expiresAt) };
  }

  const client = new JWT({
    email: config.email,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const credentials = await client.authorize();
  const token = String(credentials.access_token || "").trim();
  if (!token) throw Object.assign(new Error("Google did not issue a GA4 service-account access token"), { code: "GA4_SERVICE_ACCOUNT_TOKEN_FAILED" });
  const expiresAt = Number(credentials.expiry_date) || Date.now() + 55 * 60 * 1000;
  cachedAccessToken = { fingerprint: config.fingerprint, token, expiresAt };
  return { accessToken: token, expiresAt: new Date(expiresAt) };
}

export async function hydrateGA4ServiceAccountConnection<T extends Record<string, any>>(connection: T): Promise<T> {
  if (String(connection?.method || "").trim().toLowerCase() !== GA4_SERVICE_ACCOUNT_METHOD) return connection;
  assertGA4ServiceAccountPropertyAllowed(connection?.propertyId);
  const credentials = await getGA4ServiceAccountAccessToken();
  return {
    ...connection,
    accessToken: credentials.accessToken,
    refreshToken: null,
    clientId: null,
    clientSecret: null,
    serviceAccountKey: null,
    expiresAt: credentials.expiresAt,
  };
}

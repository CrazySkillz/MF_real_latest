import { createHash } from "crypto";
import { JWT } from "google-auth-library";
import type { GA4ClientServiceAccount } from "@shared/schema";

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

export function getGA4ServiceAccountPublicStatus(): { enabled: boolean; email: string | null; selfService?: boolean } {
  if (isGA4ClientServiceAccountSetupEnabled()) return { enabled: true, email: null, selfService: true };
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
    transporterOptions: { timeout: 120_000, signal: AbortSignal.timeout(120_000) },
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
  const binding = await assertGA4ServiceAccountConnectionAccess(connection);
  const credentials = binding ? await getGA4ClientServiceAccountAccessToken(binding) : await getGA4ServiceAccountAccessToken();
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

export async function assertGA4ServiceAccountConnectionAccess(connection: Record<string, any>): Promise<GA4ClientServiceAccount | undefined> {
  const { storage } = await import("../storage");
  const propertyId = normalizeGA4ServiceAccountPropertyId(connection.propertyId);
  if (connection.serviceAccountBindingId) {
    const binding = await storage.getGA4ClientServiceAccount(connection.campaignId, propertyId, connection.serviceAccountBindingId);
    if (!binding?.verifiedAt || !binding.googleUniqueId) throw clientAccountError("This client has not verified access to this GA4 property", 403);
    return binding;
  }
  assertGA4ServiceAccountPropertyAllowed(propertyId);
  await storage.assertServiceAccountResourceAccess(connection.campaignId, "ga4", propertyId);
}

function clientAccountError(message: string, status = 503) {
  return Object.assign(new Error(message), { code: "GA4_CLIENT_SERVICE_ACCOUNT_ERROR", status });
}

export function clientAccountConfig() {
  let config: any;
  try { config = JSON.parse(process.env.GA4_CLIENT_SERVICE_ACCOUNT_JSON || "null"); } catch { /* Fail closed below. */ }
  if (config?.type !== "service_account" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config?.project_id || "") ||
    !String(config?.client_email || "").endsWith(`@${config.project_id}.iam.gserviceaccount.com`) || !config?.private_key) {
    throw clientAccountError("Automatic Google Analytics setup is not configured. Contact support.");
  }
  return { projectId: String(config.project_id), email: String(config.client_email), key: String(config.private_key).replace(/\\n/g, "\n") };
}

export function isGA4ClientServiceAccountSetupEnabled(): boolean {
  if (process.env.GA4_CLIENT_SERVICE_ACCOUNTS_ENABLED !== "true") return false;
  clientAccountConfig();
  return true;
}

export function getGA4ClientServiceAccountEmail(clientName: string, property: unknown): string {
  const propertyId = normalizeGA4ServiceAccountPropertyId(property);
  if (!/^\d{1,20}$/.test(propertyId)) throw Object.assign(new Error("Enter a valid numeric GA4 Property ID"), { code: "GA4_PROPERTY_ID_INVALID" });
  let name = clientName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
  if (!/^[a-z]/.test(name) || name.length + propertyId.length + 1 < 6) name = `client-${name}`;
  name = name.slice(0, 29 - propertyId.length).replace(/-+$/g, "");
  return `${name}-${propertyId}@${clientAccountConfig().projectId}.iam.gserviceaccount.com`;
}

let clientIssuer: { fingerprint: string; jwt: JWT } | undefined;
const clientTokens = new Map<string, { accessToken: string; expiresAt: Date }>();
export async function clientAccountRequest(url: string, body?: unknown): Promise<Response> {
  const config = clientAccountConfig();
  const fingerprint = createHash("sha256").update(`${config.email}\n${config.key}`).digest("hex");
  if (clientIssuer?.fingerprint !== fingerprint) clientIssuer = { fingerprint, jwt: new JWT({
    email: config.email, key: config.key, scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    transporterOptions: { timeout: 20_000, signal: AbortSignal.timeout(20_000) },
  }) };
  try {
    // A fresh cancellation signal is required on every request; cached JWTs outlive the first deadline.
    clientIssuer.jwt.transporter.defaults = { ...clientIssuer.jwt.transporter.defaults, timeout: 20_000, signal: AbortSignal.timeout(20_000) };
    const { token } = await clientIssuer.jwt.getAccessToken();
    if (!token) throw new Error("No token");
    return await fetch(url, { method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch { throw clientAccountError("Google could not complete the access setup. Please retry."); }
}

export async function provisionGA4ClientServiceAccount(binding: GA4ClientServiceAccount): Promise<string> {
  if (!isGA4ClientServiceAccountSetupEnabled()) throw clientAccountError("Automatic Google Analytics setup is not enabled.");
  const config = clientAccountConfig(), suffix = `@${config.projectId}.iam.gserviceaccount.com`;
  if (!binding.email.endsWith(suffix)) throw clientAccountError("This access email belongs to a different Google project.", 409);
  const base = `https://iam.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/serviceAccounts`;
  const url = `${base}/${encodeURIComponent(binding.email)}`, description = `mimosaas-client-binding:${binding.id}`;
  let response = await clientAccountRequest(url);
  if (response.status === 404 && !binding.googleUniqueId) {
    await response.body?.cancel();
    response = await clientAccountRequest(base, { accountId: binding.email.slice(0, -suffix.length), serviceAccount: { displayName: binding.email.split("@")[0], description } });
    if (response.status === 409) { await response.body?.cancel(); response = await clientAccountRequest(url); }
  }
  if (!response.ok) { await response.body?.cancel(); throw clientAccountError("Google could not prepare the access email. Please retry or contact support."); }
  const account = await response.json();
  if (account.email !== binding.email || account.projectId !== config.projectId || account.description !== description || account.disabled === true ||
    typeof account.uniqueId !== "string" || !/^\d+$/.test(account.uniqueId) || (binding.googleUniqueId && binding.googleUniqueId !== account.uniqueId)) {
    throw clientAccountError("This access email is unavailable. Contact support; no existing account has been changed.", 409);
  }
  return account.uniqueId;
}

export async function getGA4ClientServiceAccountAccessToken(binding: GA4ClientServiceAccount): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = clientAccountConfig();
  if (!/^\d+$/.test(binding.googleUniqueId || "") || !binding.email.endsWith(`@${config.projectId}.iam.gserviceaccount.com`)) throw clientAccountError("This client's Google access identity is unavailable.", 403);
  const key = createHash("sha256").update(`${config.email}\n${config.key}\n${binding.googleUniqueId}`).digest("hex");
  const cached = clientTokens.get(key);
  if (cached && cached.expiresAt.getTime() > Date.now() + 5 * 60_000) return cached;
  // Numeric Google identity prevents a deleted/recreated email address from inheriting access.
  const response = await clientAccountRequest(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${binding.googleUniqueId}:generateAccessToken`, {
    scope: ["https://www.googleapis.com/auth/analytics.readonly"], lifetime: "3600s",
  });
  if (!response.ok) { await response.body?.cancel(); throw clientAccountError("Google could not authorise this client's access. Please retry or contact support."); }
  const data = await response.json(), expiresAt = new Date(data.expireTime);
  if (typeof data.accessToken !== "string" || !data.accessToken.trim() || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() + 60_000) throw clientAccountError("Google returned an invalid access credential.");
  const credentials = { accessToken: String(data.accessToken), expiresAt };
  if (clientTokens.size >= 256) clientTokens.delete(clientTokens.keys().next().value!);
  clientTokens.set(key, credentials);
  return credentials;
}

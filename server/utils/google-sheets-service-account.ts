import type { GoogleSheetsClientServiceAccount } from "@shared/schema";
import { clientAccountConfig, clientAccountRequest } from "./ga4-service-account";
import { createHash } from "crypto";
import { JWT } from "google-auth-library";

export const GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD = "service_account";

type GoogleSheetsServiceAccountConfig = {
  email: string;
  privateKey: string;
  fingerprint: string;
};

let cachedAccessToken: { fingerprint: string; token: string; expiresAt: number } | null = null;

export function normalizeGoogleSheetsSpreadsheetId(value: unknown): string {
  const raw = String(value || "").trim();
  const fromUrl = raw.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i)?.[1];
  const spreadsheetId = fromUrl || raw;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(spreadsheetId)) {
    throw Object.assign(new Error("Enter a valid Google Sheets URL or Spreadsheet ID"), { code: "GOOGLE_SHEETS_ID_INVALID" });
  }
  return spreadsheetId;
}

export function getGoogleSheetsServiceAccountConfig(): GoogleSheetsServiceAccountConfig | null {
  const raw = String(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON || process.env.GA4_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Google Sheets service-account JSON is invalid"), { code: "GOOGLE_SHEETS_SERVICE_ACCOUNT_CONFIG_INVALID" });
  }

  const email = String(parsed?.client_email || "").trim();
  const privateKey = String(parsed?.private_key || "").replace(/\\n/g, "\n").trim();
  if (parsed?.type !== "service_account" || !email || !privateKey) {
    throw Object.assign(new Error("Google Sheets service-account JSON is invalid or missing required credentials"), { code: "GOOGLE_SHEETS_SERVICE_ACCOUNT_CONFIG_INVALID" });
  }

  return {
    email,
    privateKey,
    fingerprint: createHash("sha256").update(`${email}\n${privateKey}`).digest("hex"),
  };
}

export function getGoogleSheetsServiceAccountPublicStatus(): { enabled: boolean; email: string | null; selfService?: boolean } {
  if (isGoogleSheetsClientServiceAccountSetupEnabled()) return { enabled: true, email: null, selfService: true };
  const config = getGoogleSheetsServiceAccountConfig();
  return { enabled: Boolean(config), email: config?.email || null };
}

export async function getGoogleSheetsServiceAccountAccessToken(): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = getGoogleSheetsServiceAccountConfig();
  if (!config) {
    throw Object.assign(new Error("Temporary Google Sheets service-account access is not configured"), { code: "GOOGLE_SHEETS_SERVICE_ACCOUNT_NOT_CONFIGURED" });
  }

  if (cachedAccessToken && cachedAccessToken.fingerprint === config.fingerprint && cachedAccessToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { accessToken: cachedAccessToken.token, expiresAt: new Date(cachedAccessToken.expiresAt) };
  }

  const client = new JWT({
    email: config.email,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const credentials = await client.authorize();
  const token = String(credentials.access_token || "").trim();
  if (!token) throw Object.assign(new Error("Google did not issue a Sheets service-account access token"), { code: "GOOGLE_SHEETS_SERVICE_ACCOUNT_TOKEN_FAILED" });
  const expiresAt = Number(credentials.expiry_date) || Date.now() + 55 * 60 * 1000;
  cachedAccessToken = { fingerprint: config.fingerprint, token, expiresAt };
  return { accessToken: token, expiresAt: new Date(expiresAt) };
}

export async function hydrateGoogleSheetsServiceAccountConnection<T extends Record<string, any>>(connection: T): Promise<T> {
  if (String(connection?.method || "").trim().toLowerCase() !== GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD) return connection;
  const { storage } = await import("../storage");
  let credentials: { accessToken: string; expiresAt: Date };
  let serviceAccountSpreadsheetId: string | undefined;
  if (connection.serviceAccountBindingId) {
    const binding = await storage.getGoogleSheetsClientServiceAccount(connection.campaignId, connection.spreadsheetId === "pending" ? undefined : connection.spreadsheetId, connection.serviceAccountBindingId);
    if (!binding?.verifiedAt || !binding.googleUniqueId) throw new Error("This client's Google Sheets access is not verified.");
    credentials = await getGoogleSheetsClientServiceAccountAccessToken(binding);
    serviceAccountSpreadsheetId = binding.spreadsheetId;
  } else {
    await storage.assertServiceAccountResourceAccess(connection.campaignId, "google_sheets", String(connection.spreadsheetId || ""));
    credentials = await getGoogleSheetsServiceAccountAccessToken();
  }
  return {
    ...connection,
    ...(serviceAccountSpreadsheetId ? { serviceAccountSpreadsheetId } : {}),
    accessToken: credentials.accessToken,
    refreshToken: null,
    clientId: null,
    clientSecret: null,
    expiresAt: credentials.expiresAt,
  };
}

export function isGoogleSheetsClientServiceAccountSetupEnabled(): boolean {
  if (process.env.GOOGLE_SHEETS_CLIENT_SERVICE_ACCOUNTS_ENABLED !== "true") return false;
  clientAccountConfig();
  return true;
}

export function getGoogleSheetsClientServiceAccountEmail(clientName: string, spreadsheet: unknown, ownerId: string, clientId: string): string {
  const spreadsheetId = normalizeGoogleSheetsSpreadsheetId(spreadsheet);
  let name = clientName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
  if (!/^[a-z]/.test(name)) name = `client-${name}`;
  const suffix = createHash("sha256").update(JSON.stringify([ownerId, clientId, spreadsheetId])).digest("hex").slice(0, 12);
  return `${name.slice(0, 10).replace(/-+$/g, "")}-sheets-${suffix}@${clientAccountConfig().projectId}.iam.gserviceaccount.com`;
}

export async function provisionGoogleSheetsClientServiceAccount(binding: GoogleSheetsClientServiceAccount): Promise<string> {
  if (!isGoogleSheetsClientServiceAccountSetupEnabled()) throw new Error("Automatic Google Sheets setup is not enabled.");
  const config = clientAccountConfig(), suffix = `@${config.projectId}.iam.gserviceaccount.com`;
  if (!binding.email.endsWith(suffix)) throw new Error("This access email belongs to a different Google project.");
  const base = `https://iam.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/serviceAccounts`;
  const url = `${base}/${encodeURIComponent(binding.email)}`, description = `mimosaas-sheets-client-binding:${binding.id}`;
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
export async function getGoogleSheetsClientServiceAccountAccessToken(binding: GoogleSheetsClientServiceAccount): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = clientAccountConfig();
  if (!/^\d+$/.test(binding.googleUniqueId || "") || !binding.email.endsWith(`@${config.projectId}.iam.gserviceaccount.com`)) throw new Error("This client's Google Sheets identity is unavailable.");
  const key = createHash("sha256").update(`${config.email}\n${config.key}\n${binding.googleUniqueId}`).digest("hex");
  const cached = clientTokens.get(key);
  if (cached && cached.expiresAt.getTime() > Date.now() + 5 * 60_000) return cached;
  const response = await clientAccountRequest(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${binding.googleUniqueId}:generateAccessToken`, {
    scope: ["https://www.googleapis.com/auth/spreadsheets.readonly"], lifetime: "3600s",
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error("Google could not authorise this client's Sheets access. Please retry or contact support."); }
  const data = await response.json(), expiresAt = new Date(data.expireTime);
  if (typeof data.accessToken !== "string" || !data.accessToken.trim() || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() + 60_000) throw new Error("Google returned an invalid access credential.");
  const credentials = { accessToken: String(data.accessToken), expiresAt };
  if (clientTokens.size >= 256) clientTokens.delete(clientTokens.keys().next().value!);
  clientTokens.set(key, credentials);
  return credentials;
}

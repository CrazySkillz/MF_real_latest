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

export function getGoogleSheetsServiceAccountPublicStatus(): { enabled: boolean; email: string | null } {
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
  const credentials = await getGoogleSheetsServiceAccountAccessToken();
  return {
    ...connection,
    accessToken: credentials.accessToken,
    refreshToken: null,
    clientId: null,
    clientSecret: null,
    expiresAt: credentials.expiresAt,
  };
}

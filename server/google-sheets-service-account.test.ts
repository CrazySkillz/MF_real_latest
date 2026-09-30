import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const authorize = vi.hoisted(() => vi.fn(async () => ({
  access_token: "temporary-sheets-token",
  expiry_date: Date.now() + 60 * 60 * 1000,
})));

vi.mock("google-auth-library", () => ({
  JWT: class {
    authorize = authorize;
  },
}));

import {
  getGoogleSheetsServiceAccountPublicStatus,
  hydrateGoogleSheetsServiceAccountConnection,
  normalizeGoogleSheetsSpreadsheetId,
} from "./utils/google-sheets-service-account";

const originalSheetsJson = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
const originalGa4Json = process.env.GA4_SERVICE_ACCOUNT_JSON;

afterEach(() => {
  if (originalSheetsJson === undefined) delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  else process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON = originalSheetsJson;
  if (originalGa4Json === undefined) delete process.env.GA4_SERVICE_ACCOUNT_JSON;
  else process.env.GA4_SERVICE_ACCOUNT_JSON = originalGa4Json;
  authorize.mockClear();
});

describe("temporary Google Sheets service-account boundary", () => {
  it("keeps OAuth first while adding the temporary connection path", () => {
    const authSource = readFileSync(resolve(process.cwd(), "client/src/components/SimpleGoogleSheetsAuth.tsx"), "utf8");
    expect(authSource).toContain("/api/auth/google-sheets/connect");
    expect(authSource.indexOf("Connect Google Sheets")).toBeLessThan(authSource.indexOf("Temporary test connection"));
  });

  it("lets an existing source connect a different shared spreadsheet", () => {
    const authSource = readFileSync(resolve(process.cwd(), "client/src/components/SimpleGoogleSheetsAuth.tsx"), "utf8");
    const selectionStart = authSource.indexOf("// Show spreadsheet selection after auth");
    const selectionEnd = authSource.indexOf("// Keep the auth check silent", selectionStart);
    const selection = authSource.slice(selectionStart, selectionEnd);

    expect(selection).toContain("Connect shared spreadsheet");
    expect(selection).toContain("connectSharedSpreadsheet");
    expect(selection).toContain("serviceAccountStatus.enabled");
  });

  it("accepts a spreadsheet ID or canonical Google Sheets URL", () => {
    const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz_12345";
    expect(normalizeGoogleSheetsSpreadsheetId(id)).toBe(id);
    expect(normalizeGoogleSheetsSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
    expect(() => normalizeGoogleSheetsSpreadsheetId("https://example.com/not-a-sheet")).toThrow(/valid Google Sheets URL/i);
  });

  it("exposes only the configured service-account email", () => {
    delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
    process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      client_email: "reader@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
    });

    expect(getGoogleSheetsServiceAccountPublicStatus()).toEqual({
      enabled: true,
      email: "reader@example.iam.gserviceaccount.com",
    });
  });

  it("hydrates saved service-account rows with a short-lived read-only token in memory", async () => {
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      client_email: "sheets-reader@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\ntest-sheets\\n-----END PRIVATE KEY-----\\n",
    });

    const hydrated = await hydrateGoogleSheetsServiceAccountConnection({
      method: "service_account",
      accessToken: null,
      refreshToken: "must-not-survive",
      clientId: "must-not-survive",
      clientSecret: "must-not-survive",
    });

    expect(hydrated.accessToken).toBe("temporary-sheets-token");
    expect(hydrated.refreshToken).toBeNull();
    expect(hydrated.clientId).toBeNull();
    expect(hydrated.clientSecret).toBeNull();
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it("keeps service-account credentials out of saved Google Sheets rows", () => {
    const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
    const createStart = storageSource.indexOf("async createGoogleSheetsConnection");
    const createEnd = storageSource.indexOf("async updateGoogleSheetsConnection", createStart);
    const createMethod = storageSource.slice(createStart, createEnd);

    expect(createMethod).toContain("accessToken: isServiceAccount ? null");
    expect(createMethod).toContain("refreshToken: isServiceAccount ? null");
    expect(createMethod).toContain("clientId: isServiceAccount ? null");
    expect(createMethod).toContain("clientSecret: isServiceAccount ? null");
  });

  it("allows shared spreadsheet reuse while keeping each temporary connection campaign-scoped and read-only", () => {
    const routesSource = readFileSync(resolve(process.cwd(), "server/routes-oauth.ts"), "utf8");
    const helperSource = readFileSync(resolve(process.cwd(), "server/utils/google-sheets-service-account.ts"), "utf8");
    const routeStart = routesSource.indexOf('app.post("/api/campaigns/:id/google-sheets-service-account/connect"');
    const routeEnd = routesSource.indexOf("// OAuth code exchange for Google Sheets", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("requireCampaignAccessParamId");
    expect(route).toContain("storage.getGoogleSheetsConnections(campaignId)");
    expect(route).not.toContain("already connected to another account");
    expect(route).not.toContain("existingClaims");
    expect(helperSource).toContain("https://www.googleapis.com/auth/spreadsheets.readonly");
    expect(helperSource).not.toContain("https://www.googleapis.com/auth/drive");
  });
});

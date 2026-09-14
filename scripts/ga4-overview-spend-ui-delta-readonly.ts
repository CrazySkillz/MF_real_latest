import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";

const BASE_URL = String(process.env.GA4_OVERVIEW_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_SPEND_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_SPEND_CAMPAIGN_ID || "").trim();
const CLERK_SECRET = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_OVERVIEW_SPEND_EXPECTED_SHA must be the exact deployed SHA");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_OVERVIEW_SPEND_CAMPAIGN_ID must be an explicit campaign UUID");

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const stableJson = (value: unknown): string => JSON.stringify(value, (_key, item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
});
const parseMapping = (raw: unknown) => {
  try { return raw && typeof raw === "object" ? raw as Record<string, unknown> : JSON.parse(String(raw || "{}")); }
  catch { return {}; }
};
const stableMapping = (raw: unknown) => {
  const { lastSyncedAt: _lastSyncedAt, ...mapping } = parseMapping(raw);
  return mapping;
};
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const box = async (locator: ReturnType<Page["locator"]>) => {
  const value = await locator.boundingBox();
  assert(value, "Tracked Spend position is unavailable");
  return { x: Number(value!.x.toFixed(2)), y: Number(value!.y.toFixed(2)) };
};
const positionMatches = (left: { x: number; y: number }, right: { x: number; y: number }) =>
  Math.abs(left.x - right.x) <= 0.5 && Math.abs(left.y - right.y) <= 0.5;

const dbClient = await pool.connect();
let context: BrowserContext | null = null;
let sessionId = "";
let signInTokenId = "";
try {
  const campaignResult = await dbClient.query(`
    SELECT id::text, owner_id, client_id, name, currency, spend::text
    FROM campaigns WHERE id = $1 LIMIT 1
  `, [CAMPAIGN_ID]);
  assert(campaignResult.rowCount === 1, "Target campaign was not found");
  const campaign = campaignResult.rows[0];

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => ({}));
  assert(healthResponse.ok && health?.commit === EXPECTED_SHA, `Expected deployed SHA ${EXPECTED_SHA}, received ${String(health?.commit || "unknown")}`);

  const state = async () => {
    const [sourceResult, recordResult, connectionResult, campaignState] = await Promise.all([
      dbClient.query(`
        SELECT id::text, source_type, platform_context, display_name, currency, mapping_config, is_active
        FROM spend_sources WHERE campaign_id = $1 ORDER BY id
      `, [CAMPAIGN_ID]),
      dbClient.query(`
        SELECT spend_source_id, date, spend::text, currency, source_type
        FROM spend_records WHERE campaign_id = $1 ORDER BY spend_source_id, date, spend, source_type
      `, [CAMPAIGN_ID]),
      dbClient.query(`
        SELECT id::text, spreadsheet_id, purpose, spreadsheet_name, sheet_name, is_active, is_primary
        FROM google_sheets_connections WHERE campaign_id = $1 AND spreadsheet_id <> 'pending' ORDER BY id
      `, [CAMPAIGN_ID]),
      dbClient.query(`SELECT spend::text FROM campaigns WHERE id = $1`, [CAMPAIGN_ID]),
    ]);
    return {
      campaignSpend: String(campaignState.rows[0]?.spend || "0"),
      sources: sourceResult.rows.map((source) => ({
        id: source.id,
        sourceType: source.source_type,
        platformContext: source.platform_context,
        displayName: source.display_name,
        currency: source.currency,
        mapping: stableMapping(source.mapping_config),
        isActive: source.is_active,
      })),
      records: recordResult.rows,
      connections: connectionResult.rows,
    };
  };

  const beforeState = await state();
  const activeSources = beforeState.sources.filter((source) => source.isActive !== false && String(source.platformContext || "ga4") === "ga4");
  const csvSource = activeSources.find((source) => source.sourceType === "csv");
  const sheetSource = activeSources.find((source) => source.sourceType === "google_sheets");
  assert(csvSource && sheetSource, "Target campaign must have active CSV and Google Sheets Spend sources");
  const csvName = String(csvSource!.displayName || "").trim();
  const sheetName = String((sheetSource!.mapping as any)?.sheetName || "").trim();
  const sheetConnectionId = String((sheetSource!.mapping as any)?.connectionId || "").trim();
  const sheetConnection = beforeState.connections.find((connection) => String(connection.id) === sheetConnectionId);
  const spreadsheetName = String(sheetConnection?.spreadsheet_name || "").trim();
  assert(csvName, "CSV filename is unavailable");
  assert(sheetName, "Google Sheets tab name is unavailable");
  assert(spreadsheetName, "Google Sheets spreadsheet name is unavailable");

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: campaign.owner_id, expires_in_seconds: 900 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  assert(tokenResponse.ok && tokenBody?.token, `Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || "");
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  const unexpectedMutationAttempts: string[] = [];
  let csvPreviewRequests = 0;
  await context.route(`${BASE_URL}/api/**`, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const pathname = new URL(request.url()).pathname;
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return route.continue();
    if (method === "POST" && pathname === `/api/campaigns/${CAMPAIGN_ID}/spend/csv/preview`) {
      csvPreviewRequests += 1;
      return route.continue();
    }
    unexpectedMutationAttempts.push(`${method} ${pathname}`);
    return route.abort("blockedbyclient");
  });

  await page.goto(`${BASE_URL}/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-metrics?tab=overview&readOnly=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const addSpendButton = page.getByTestId("ga4-add-spend-source");
  await addSpendButton.waitFor({ state: "visible", timeout: 120_000 });
  const totalSpendLabel = page.getByText("Total Spend", { exact: true }).first();
  await totalSpendLabel.scrollIntoViewIfNeeded();
  const spendCard = totalSpendLabel.locator("xpath=ancestor::div[.//button[starts-with(normalize-space(.), 'Sources (')]][1]");
  const sourceButton = spendCard.getByRole("button", { name: /^Sources \(\d+\)$/ });
  await sourceButton.waitFor({ state: "visible", timeout: 30_000 });
  const initialPosition = await box(totalSpendLabel);

  await sourceButton.click();
  const sourceDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Spend Sources", exact: true }) });
  await sourceDialog.waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  const sourceDialogPosition = await box(totalSpendLabel);
  assert(positionMatches(initialPosition, sourceDialogPosition), `Spend Sources shifted page content: ${stableJson({ initialPosition, sourceDialogPosition })}`);

  const editButtons = sourceDialog.locator('button[title="Edit spend source"]');
  assert(await editButtons.count() === activeSources.length, "Spend Sources edit-button count does not match active source count");
  const rowTexts: string[] = [];
  for (let index = 0; index < await editButtons.count(); index += 1) {
    rowTexts.push(String(await editButtons.nth(index).locator("xpath=../..").innerText()).replace(/\s+/g, " ").trim());
  }
  assert(rowTexts.some((text) => text.includes("CSV") && text.includes(csvName)), "Spend Sources does not show CSV above its filename");
  assert(rowTexts.some((text) => text.includes("Google Sheets") && text.includes(sheetName)), "Spend Sources does not show the Google Sheets tab name");

  const sheetRow = sourceDialog.getByText("Google Sheets", { exact: true }).locator("xpath=../..");
  await sheetRow.locator('button[title="Edit spend source"]').click();
  const sheetEditDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Edit Google Sheets spend", exact: true }) });
  await sheetEditDialog.waitFor({ state: "visible" });
  await sheetEditDialog.getByText("Choose Google Sheet", { exact: true }).waitFor({ state: "visible", timeout: 60_000 });
  assert((await sheetEditDialog.innerText()).includes("Choose Google Sheet"), "Google Sheets edit did not open at its first wizard stage");
  assert((await sheetEditDialog.innerText()).includes(sheetName), "Google Sheets edit does not show the saved sheet/tab");
  await page.keyboard.press("Escape");
  await sheetEditDialog.waitFor({ state: "hidden" });

  await sourceButton.click();
  await sourceDialog.waitFor({ state: "visible" });
  const csvRow = sourceDialog.getByText("CSV", { exact: true }).locator("xpath=../..");
  await csvRow.locator('button[title="Edit spend source"]').click();
  const csvEditDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Edit CSV spend", exact: true }) });
  await csvEditDialog.waitFor({ state: "visible" });
  assert((await csvEditDialog.innerText()).includes(`Current file: ${csvName}`), "CSV edit first stage does not show the current filename");
  assert((await csvEditDialog.innerText()).includes("You can map the columns next"), "CSV mapping guidance is missing");
  await csvEditDialog.getByRole("button", { name: "Next", exact: true }).click();
  const campaignIdentifierLabel = csvEditDialog.getByText("Campaign identifier (optional)", { exact: true });
  await campaignIdentifierLabel.waitFor({ state: "visible" });
  await campaignIdentifierLabel.locator("..").getByRole("combobox").click();
  const fullFileOption = page.getByRole("option", { name: "None — import the full file", exact: true });
  await fullFileOption.waitFor({ state: "visible" });
  await fullFileOption.click();
  await csvEditDialog.getByRole("button", { name: "Back", exact: true }).click();
  await csvEditDialog.getByText("Current file:", { exact: true }).waitFor({ state: "visible" });
  assert((await csvEditDialog.innerText()).includes(`Current file: ${csvName}`), "CSV filename was lost after mapping Back navigation");
  await page.keyboard.press("Escape");
  await csvEditDialog.waitFor({ state: "hidden" });

  await addSpendButton.click();
  const addDialog = page.locator("[data-add-spend-dialog]");
  await addDialog.waitFor({ state: "visible" });
  await addDialog.getByRole("heading", { name: "Add spend source", exact: true }).waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  const addDialogPosition = await box(totalSpendLabel);
  assert(positionMatches(initialPosition, addDialogPosition), `Add Spend source shifted page content: ${stableJson({ initialPosition, addDialogPosition })}`);
  await addDialog.getByRole("button", { name: "Add another sheet", exact: true }).waitFor({ state: "visible", timeout: 60_000 });
  await addDialog.getByRole("button", { name: "Add another file", exact: true }).waitFor({ state: "visible", timeout: 60_000 });
  const addText = String(await addDialog.innerText()).replace(/\s+/g, " ");
  assert(addText.includes("Connected | Add another sheet"), "Connected Google Sheets status/action is missing");
  assert(addText.includes("Uploaded | Add another file"), "Uploaded CSV status/action is missing");
  await addDialog.getByRole("button", { name: "Disconnect Google Sheets Spend", exact: true }).waitFor({ state: "visible" });
  await addDialog.getByRole("button", { name: "Remove CSV Spend source", exact: true }).waitFor({ state: "visible" });

  await addDialog.getByRole("button", { name: "Add another sheet", exact: true }).click();
  try {
    await addDialog.getByText("Select Your Spreadsheet", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    throw new Error(`Add another sheet did not reach the spreadsheet picker: ${String(await addDialog.innerText()).replace(/\s+/g, " ").slice(0, 500)}`);
  }
  const availableSpreadsheetsLabel = addDialog.getByText("Available Spreadsheets", { exact: true });
  await availableSpreadsheetsLabel.locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: spreadsheetName, exact: true }).click();
  const scrollList = addDialog.locator("div.scrollbar-hide.overflow-y-auto").filter({ hasText: sheetName }).last();
  await scrollList.waitFor({ state: "visible", timeout: 60_000 });
  const scrollBefore = await scrollList.evaluate((element) => ({
    top: element.scrollTop,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollbarWidth: getComputedStyle(element).scrollbarWidth,
  }));
  assert(scrollBefore.overflowY === "auto" && scrollBefore.scrollbarWidth === "none", `Spend sheet list scrollbar contract failed: ${stableJson(scrollBefore)}`);
  assert(scrollBefore.scrollHeight > scrollBefore.height, "Spend sheet list does not have enough rows to validate mouse scrolling");
  await scrollList.hover();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(250);
  const scrollAfter = await scrollList.evaluate((element) => element.scrollTop);
  assert(scrollAfter > scrollBefore.top, "Spend sheet list did not respond to mouse-wheel scrolling");
  await addDialog.getByRole("button", { name: "Back", exact: true }).click();
  await addDialog.getByText("Choose Google Sheet", { exact: true }).waitFor({ state: "visible" });
  await addDialog.getByRole("button", { name: "Back", exact: true }).click();
  await addDialog.getByRole("button", { name: "Add another file", exact: true }).waitFor({ state: "visible" });

  await addDialog.getByRole("button", { name: "Add another file", exact: true }).click();
  await addDialog.getByRole("heading", { name: "Upload CSV", exact: true }).waitFor({ state: "visible" });
  const previewName = "spend-delta-preview.csv";
  await addDialog.locator('input[type="file"]').setInputFiles({
    name: previewName,
    mimeType: "text/csv",
    buffer: Buffer.from("date,amount\n2026-09-12,1\n2026-09-13,2", "utf8"),
  });
  await addDialog.getByRole("button", { name: "Next", exact: true }).click();
  await addDialog.getByText("Campaign identifier (optional)", { exact: true }).waitFor({ state: "visible", timeout: 60_000 });
  assert((await addDialog.innerText()).includes("None — import the full file"), "Two-column CSV did not default to full-file import");
  await addDialog.getByRole("button", { name: "Back", exact: true }).click();
  await addDialog.getByText("Selected file:", { exact: true }).waitFor({ state: "visible" });
  assert((await addDialog.innerText()).includes(`Selected file: ${previewName}`), "Selected CSV filename was lost after mapping Back navigation");
  await page.keyboard.press("Escape");
  await addDialog.waitFor({ state: "hidden" });
  await page.waitForTimeout(350);
  const closedPosition = await box(totalSpendLabel);
  assert(positionMatches(initialPosition, closedPosition), `Closing Spend dialog shifted page content: ${stableJson({ initialPosition, closedPosition })}`);

  assert(csvPreviewRequests === 1, `Expected one read-only CSV preview request, observed ${csvPreviewRequests}`);
  assert(unexpectedMutationAttempts.length === 0, `Unexpected app mutation attempts were blocked: ${unexpectedMutationAttempts.join(", ")}`);
  const afterState = await state();
  assert(stableJson(afterState) === stableJson(beforeState), "Stable campaign Spend state changed during read-only UI validation");

  console.log(JSON.stringify({
    status: "passed",
    mode: "deployed_spend_ui_delta_readonly",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    clientHash: hash(campaign.client_id),
    ownerHash: hash(campaign.owner_id),
    currency: String(campaign.currency || "USD").toUpperCase(),
    sourceCount: activeSources.length,
    sourceLabels: { csv: csvName, googleSheetsSpreadsheet: spreadsheetName, googleSheetsTab: sheetName },
    checks: {
      spendSourcesLabels: true,
      sourceEditStartsAtFirstStage: true,
      currentCsvFilenameVisible: true,
      csvFilenameRetainedAfterBack: true,
      fullFileCsvOptionVisible: true,
      connectedAndUploadedActionsVisible: true,
      deleteControlsVisibleNotInvoked: true,
      addAnotherSheetPickerVisible: true,
      sheetListScrollbarHidden: true,
      sheetListMouseWheelScrolls: true,
      spendDialogsDoNotShiftPage: true,
      stableCampaignSpendStateUnchanged: true,
    },
    network: { csvPreviewRequests, unexpectedMutationAttempts },
    googleAds: "NOT CONFIGURED / EXCLUDED — not interacted with or tested",
    exclusions: [
      "Google Ads behavior and readiness",
      "destructive UI confirmation actions",
      "Revenue behavior and evidence",
    ],
  }, null, 2));
} finally {
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  const browser = context?.browser();
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  dbClient.release();
  await pool.end().catch(() => null);
}

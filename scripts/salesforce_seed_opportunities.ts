/**
 * Seed Salesforce with test Opportunities for MetricMind mapping/testing.
 *
 * Runs against ANY Salesforce org (Developer Edition / Sandbox / Production) as long as you provide:
 * - SF_INSTANCE_URL  e.g. "https://your-domain.my.salesforce.com"
 * - SF_ACCESS_TOKEN  a valid OAuth access token with scope "api"
 *
 * Recommended way to get token for a dev org:
 * - Use Salesforce CLI (`sf org login web`) then `sf org display --verbose` to copy instanceUrl + accessToken.
 *
 * Optional env vars:
 * - SF_API_VERSION           default "v59.0"
 * - SF_ACCOUNT_ID            if provided, Opportunities will be created under this AccountId
 * - SF_ACCOUNT_NAME          default "MetricMind Test Account"
 * - OPPORTUNITY_COUNT        default "25"
 * - OPPORTUNITY_NAME_PREFIX  default "MetricMind Test Opportunity"
 * - OPPORTUNITY_STAGE        default "Closed Won"
 * - OPPORTUNITY_AMOUNT_MIN   default "100"
 * - OPPORTUNITY_AMOUNT_MAX   default "5000"
 * - OPPORTUNITY_CLOSE_DAYS   default "14" (today + N days)
 *
 * Optional (useful for campaign crosswalk tests):
 * - CAMPAIGN_FIELD_API_NAME  e.g. "LinkedIn_Campaign__c" or "UTM_Campaign__c"
 * - CAMPAIGN_FIELD_VALUES    e.g. "LI_Campaign_A,LI_Campaign_B,LI_Campaign_C"
 *
 * Run:
 *   npx tsx scripts/salesforce_seed_opportunities.ts
 */
import process from "node:process";

function requireEnv(name: string): string {
  const v = String(process.env[name] || "").trim();
  if (!v) {
    console.error(`Missing env var ${name}.`);
    process.exit(2);
  }
  return v;
}

function parseIntEnv(name: string, def: number, min?: number, max?: number): number {
  const raw = String(process.env[name] ?? "").trim();
  const n = raw ? Number.parseInt(raw, 10) : def;
  const safe = Number.isFinite(n) ? n : def;
  const clampedMin = min !== undefined ? Math.max(safe, min) : safe;
  const clamped = max !== undefined ? Math.min(clampedMin, max) : clampedMin;
  return clamped;
}

function parseNumEnv(name: string, def: number): number {
  const raw = String(process.env[name] ?? "").trim();
  const n = raw ? Number(raw) : def;
  return Number.isFinite(n) ? n : def;
}

function normalizeInstanceUrl(input: string): string {
  let u = String(input || "").trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  u = u.replace(/\/+$/, "");
  return u;
}

function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function sfFetch(instanceUrl: string, apiVersion: string, accessToken: string, path: string, init?: RequestInit) {
  const url = `${instanceUrl}/services/data/${apiVersion}${path.startsWith("/") ? "" : "/"}${path}`;
  const resp = await fetch(url, {
    ...(init || {}),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await resp.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!resp.ok) {
    const msg =
      (Array.isArray(json) ? json?.[0]?.message : null) ||
      (json && (json.message || json.error || json.error_description)) ||
      (text && text.length < 800 ? text : "") ||
      `HTTP ${resp.status}`;
    throw new Error(`Salesforce API error ${resp.status}: ${String(msg)}`);
  }
  return json;
}

async function ensureAccountId(instanceUrl: string, apiVersion: string, accessToken: string): Promise<string> {
  const existing = String(process.env.SF_ACCOUNT_ID || "").trim();
  if (existing) return existing;

  const name = (process.env.SF_ACCOUNT_NAME || "MetricMind Test Account").trim();
  const created = await sfFetch(instanceUrl, apiVersion, accessToken, "/sobjects/Account", {
    method: "POST",
    body: JSON.stringify({ Name: name }),
  });
  const id = String(created?.id || "").trim();
  if (!id) throw new Error("Failed to create Account (missing id).");
  console.log(`✅ Created Account: ${name} (AccountId=${id})`);
  return id;
}

async function validateOpportunityFieldExists(
  instanceUrl: string,
  apiVersion: string,
  accessToken: string,
  fieldApiName: string
): Promise<void> {
  const describe = await sfFetch(instanceUrl, apiVersion, accessToken, "/sobjects/Opportunity/describe");
  const fields = Array.isArray(describe?.fields) ? describe.fields : [];
  const ok = fields.some((f: any) => String(f?.name || "") === fieldApiName);
  if (!ok) {
    const sample = fields
      .slice(0, 40)
      .map((f: any) => String(f?.name || ""))
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Opportunity field "${fieldApiName}" was not found in this org. ` +
        `Double-check the API name (custom fields usually end with __c). Sample fields: ${sample}`
    );
  }
}

async function main() {
  const apiVersion = (process.env.SF_API_VERSION || "v59.0").trim();
  const instanceUrl = normalizeInstanceUrl(requireEnv("SF_INSTANCE_URL"));
  const accessToken = requireEnv("SF_ACCESS_TOKEN");

  const count = parseIntEnv("OPPORTUNITY_COUNT", 25, 1, 500);
  const namePrefix = (process.env.OPPORTUNITY_NAME_PREFIX || "MetricMind Test Opportunity").trim();
  const stageName = (process.env.OPPORTUNITY_STAGE || "Closed Won").trim();
  const amountMin = parseNumEnv("OPPORTUNITY_AMOUNT_MIN", 100);
  const amountMax = parseNumEnv("OPPORTUNITY_AMOUNT_MAX", 5000);
  const closeDays = parseIntEnv("OPPORTUNITY_CLOSE_DAYS", 14, 0, 3650);
  const closeDate = isoDateDaysFromNow(closeDays);

  const campaignField = String(process.env.CAMPAIGN_FIELD_API_NAME || "").trim();
  const campaignValuesRaw = String(process.env.CAMPAIGN_FIELD_VALUES || "").trim();
  const campaignValues = campaignValuesRaw
    ? campaignValuesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  console.log(`Instance: ${instanceUrl}`);
  console.log(`API version: ${apiVersion}`);
  console.log(`Creating ${count} Opportunities…`);

  if (campaignField) {
    await validateOpportunityFieldExists(instanceUrl, apiVersion, accessToken, campaignField);
    if (campaignValues.length === 0) {
      console.warn(`⚠️  CAMPAIGN_FIELD_API_NAME is set but CAMPAIGN_FIELD_VALUES is empty; field will be left blank.`);
    } else {
      console.log(`Campaign field: ${campaignField}`);
      console.log(`Campaign values: ${campaignValues.join(", ")}`);
    }
  }

  const accountId = await ensureAccountId(instanceUrl, apiVersion, accessToken);

  const createdOppIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const amt = amountMin + Math.random() * Math.max(0, amountMax - amountMin);
    const amount = Math.round(amt * 100) / 100;
    const name = `${namePrefix} #${i + 1} (${Date.now()})`;

    const payload: any = {
      Name: name,
      AccountId: accountId,
      StageName: stageName,
      CloseDate: closeDate,
      Amount: amount,
    };

    if (campaignField && campaignValues.length > 0) {
      payload[campaignField] = campaignValues[i % campaignValues.length];
    }

    const created = await sfFetch(instanceUrl, apiVersion, accessToken, "/sobjects/Opportunity", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const id = String(created?.id || "").trim();
    if (id) createdOppIds.push(id);
  }

  console.log(`✅ Done. Created ${createdOppIds.length} Opportunities.`);
  if (createdOppIds.length > 0) {
    console.log(`First OpportunityId: ${createdOppIds[0]}`);
  }
}

main().catch((e) => {
  console.error(`❌ Failed: ${(e as any)?.message || e}`);
  process.exit(1);
});



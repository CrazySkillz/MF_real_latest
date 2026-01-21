/**
 * Standalone Salesforce seeding script (NO MetricMind/Render required).
 *
 * Auth method: OAuth "password" grant (for dev/test only).
 * You need a Salesforce Connected App (client id/secret) that allows this flow.
 *
 * Required env vars:
 * - SF_LOGIN_URL      "https://login.salesforce.com" (prod/dev) OR "https://test.salesforce.com" (sandbox)
 * - SF_CLIENT_ID
 * - SF_CLIENT_SECRET
 * - SF_USERNAME
 * - SF_PASSWORD       (password ONLY, without token)
 * - SF_SECURITY_TOKEN (reset in Salesforce: Setup → "Reset My Security Token")
 *
 * Optional:
 * - SF_API_VERSION           default "v59.0"
 * - SF_ACCOUNT_NAME          default "MetricMind Test Account"
 * - OPPORTUNITY_COUNT        default "25"
 * - OPPORTUNITY_NAME_PREFIX  default "MetricMind Test Opportunity"
 * - OPPORTUNITY_STAGE        default "Closed Won"
 * - OPPORTUNITY_AMOUNT_MIN   default "100"
 * - OPPORTUNITY_AMOUNT_MAX   default "5000"
 * - OPPORTUNITY_CLOSE_DAYS   default "14"
 *
 * Optional (campaign crosswalk tests):
 * - CAMPAIGN_FIELD_API_NAME  e.g. "UTM_Campaign__c"
 * - CAMPAIGN_FIELD_VALUES    e.g. "LI_Campaign_A,LI_Campaign_B,LI_Campaign_C"
 *
 * Run:
 *   npx tsx scripts/salesforce_seed_opportunities_password_grant.ts
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

function normalizeBaseUrl(input: string): string {
  let u = String(input || "").trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  u = u.replace(/\/+$/, "");
  return u;
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

function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function salesforceTokenPasswordGrant(args: {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  passwordPlusToken: string;
}) {
  const { loginUrl, clientId, clientSecret, username, passwordPlusToken } = args;
  const url = `${loginUrl}/services/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password: passwordPlusToken,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.access_token || !json?.instance_url) {
    const msg = json?.error_description || json?.error || `HTTP ${resp.status}`;
    throw new Error(`Salesforce token error: ${String(msg)}`);
  }
  return {
    accessToken: String(json.access_token),
    instanceUrl: String(json.instance_url).replace(/\/+$/, ""),
    idUrl: json?.id ? String(json.id) : null,
  };
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
    throw new Error(
      `Opportunity field "${fieldApiName}" was not found. Double-check the API name (custom fields usually end with __c).`
    );
  }
}

async function main() {
  const loginUrl = normalizeBaseUrl(requireEnv("SF_LOGIN_URL"));
  const clientId = requireEnv("SF_CLIENT_ID");
  const clientSecret = requireEnv("SF_CLIENT_SECRET");
  const username = requireEnv("SF_USERNAME");
  const password = requireEnv("SF_PASSWORD");
  const securityToken = requireEnv("SF_SECURITY_TOKEN");

  const apiVersion = (process.env.SF_API_VERSION || "v59.0").trim();
  const opportunityCount = parseIntEnv("OPPORTUNITY_COUNT", 25, 1, 500);
  const accountName = String(process.env.SF_ACCOUNT_NAME || "MetricMind Test Account").trim();
  const namePrefix = String(process.env.OPPORTUNITY_NAME_PREFIX || "MetricMind Test Opportunity").trim();
  const stageName = String(process.env.OPPORTUNITY_STAGE || "Closed Won").trim();
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

  console.log(`Login URL: ${loginUrl}`);
  console.log(`API version: ${apiVersion}`);

  const { accessToken, instanceUrl } = await salesforceTokenPasswordGrant({
    loginUrl,
    clientId,
    clientSecret,
    username,
    passwordPlusToken: `${password}${securityToken}`,
  });

  console.log(`✅ Auth OK. instanceUrl=${instanceUrl}`);

  if (campaignField) {
    await validateOpportunityFieldExists(instanceUrl, apiVersion, accessToken, campaignField);
    if (campaignValues.length === 0) {
      console.warn(`⚠️  CAMPAIGN_FIELD_API_NAME is set but CAMPAIGN_FIELD_VALUES is empty; field will be left blank.`);
    } else {
      console.log(`Campaign field: ${campaignField}`);
      console.log(`Campaign values: ${campaignValues.join(", ")}`);
    }
  }

  const acc = await sfFetch(instanceUrl, apiVersion, accessToken, "/sobjects/Account", {
    method: "POST",
    body: JSON.stringify({ Name: accountName }),
  });
  const accountId = String(acc?.id || "").trim();
  if (!accountId) throw new Error("Failed to create Account (missing id).");
  console.log(`✅ Created Account: ${accountName} (AccountId=${accountId})`);

  const oppIds: string[] = [];
  for (let i = 0; i < opportunityCount; i++) {
    const amt = amountMin + Math.random() * Math.max(0, amountMax - amountMin);
    const amount = Math.round(amt * 100) / 100;
    const payload: any = {
      Name: `${namePrefix} #${i + 1} (${Date.now()})`,
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
    if (id) oppIds.push(id);
  }

  console.log(`✅ Done. Created ${oppIds.length} Opportunities.`);
  if (oppIds.length > 0) console.log(`First OpportunityId: ${oppIds[0]}`);
}

main().catch((e) => {
  console.error(`❌ Failed: ${(e as any)?.message || e}`);
  process.exit(1);
});



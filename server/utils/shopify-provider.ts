export const DEFAULT_SHOPIFY_API_VERSION = '2026-07';

const SUPPORTED_SHOPIFY_API_VERSIONS = new Set(['2025-10', '2026-01', '2026-04', '2026-07']);
const SHOPIFY_HOST_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShopifyDomain(input: unknown): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^https?:\/\//i, '');
  const host = withoutProtocol.split('/')[0].trim().toLowerCase();
  return SHOPIFY_HOST_PATTERN.test(host) ? host : '';
}

export function getShopifyApiVersion(configured = process.env.SHOPIFY_API_VERSION): string {
  const version = String(configured || DEFAULT_SHOPIFY_API_VERSION).trim();
  if (!SUPPORTED_SHOPIFY_API_VERSIONS.has(version)) {
    throw new Error(`Unsupported Shopify API version: ${version}`);
  }
  return version;
}

export function hasRequiredShopifyOrderScope(scopes: Iterable<string>): boolean {
  const normalized = new Set(Array.from(scopes, scope => String(scope || '').trim().toLowerCase()));
  return normalized.has('read_orders') || normalized.has('write_orders');
}

export function hasShopifyAllOrdersScope(scopes: Iterable<string>): boolean {
  return Array.from(scopes, scope => String(scope || '').trim().toLowerCase()).includes('read_all_orders');
}

export function requireShopifyOrderScope(scopes: Iterable<string>): void {
  if (!hasRequiredShopifyOrderScope(scopes)) {
    throw new Error('Shopify access token is missing the required read_orders scope');
  }
}

export function requireShopifyRevenueScopes(scopes: Iterable<string>): void {
  const normalized = Array.from(scopes, scope => String(scope || '').trim().toLowerCase());
  requireShopifyOrderScope(normalized);
  if (!hasShopifyAllOrdersScope(normalized)) {
    throw new Error('Shopify access token is missing the required read_all_orders scope');
  }
}

export function requireShopifyOrderWindowScopes(scopes: Iterable<string>, createdAtMin: string, now = Date.now()): void {
  const normalized = Array.from(scopes, scope => String(scope || '').trim().toLowerCase());
  requireShopifyOrderScope(normalized);
  const start = Date.parse(createdAtMin);
  if (!Number.isFinite(start)) throw new Error('Invalid Shopify order window start');
  if (now - start > 60 * 24 * 60 * 60 * 1000 && !hasShopifyAllOrdersScope(normalized)) {
    throw new Error('Shopify access token is missing read_all_orders for an order window older than 60 days');
  }
}

export type ShopifyOauthState = {
  campaignId: string;
  shopDomain: string;
  sessionId: string;
  createdAt: number;
};

export function validateShopifyOauthState(
  stored: ShopifyOauthState | null | undefined,
  expected: { campaignId: string; shopDomain: string; sessionId: string },
  now: number,
  ttlMs: number,
): void {
  if (!stored || stored.campaignId !== expected.campaignId) throw new Error('Invalid OAuth state');
  if (!stored.createdAt || now - stored.createdAt > ttlMs || now < stored.createdAt) throw new Error('Expired OAuth state');
  if (!expected.sessionId || stored.sessionId !== expected.sessionId) throw new Error('OAuth session mismatch');
  if (stored.shopDomain !== expected.shopDomain) throw new Error('OAuth shop mismatch');
}

export type ShopifyExpiringOfflineToken = {
  accessToken: string;
  refreshToken: string;
  scope: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

export function parseShopifyExpiringOfflineToken(payload: any, issuedAt = Date.now()): ShopifyExpiringOfflineToken {
  const accessToken = String(payload?.access_token || '').trim();
  const refreshToken = String(payload?.refresh_token || '').trim();
  const expiresIn = Number(payload?.expires_in);
  const refreshTokenExpiresIn = Number(payload?.refresh_token_expires_in);
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0
    || !Number.isFinite(refreshTokenExpiresIn) || refreshTokenExpiresIn <= 0) {
    throw new Error('Shopify returned an incomplete expiring offline token');
  }
  return {
    accessToken,
    refreshToken,
    scope: String(payload?.scope || '').trim(),
    accessTokenExpiresAt: new Date(issuedAt + expiresIn * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(issuedAt + refreshTokenExpiresIn * 1000).toISOString(),
  };
}

async function requestShopifyExpiringOfflineToken(args: {
  shopDomain: string;
  body: URLSearchParams;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<ShopifyExpiringOfflineToken> {
  const shopDomain = normalizeShopifyDomain(args.shopDomain);
  if (!shopDomain) throw new Error('Invalid Shopify shop domain');
  const response = await (args.fetchImpl || fetch)(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: args.body,
    signal: AbortSignal.timeout(30000),
  });
  const json: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(String(json?.error_description || json?.error || `Shopify token request failed (HTTP ${response.status})`));
    error.status = response.status;
    throw error;
  }
  return parseShopifyExpiringOfflineToken(json, (args.now || Date.now)());
}

export async function refreshShopifyOfflineAccessToken(args: {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<ShopifyExpiringOfflineToken> {
  return requestShopifyExpiringOfflineToken({
    ...args,
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: args.clientId,
      client_secret: args.clientSecret,
      refresh_token: args.refreshToken,
    }),
  });
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function shopifyAdminFetch(args: {
  shopDomain: string;
  accessToken: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  body?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  max429Retries?: number;
  requestTimeoutMs?: number;
  onResponse?: (event: { attempt: number; status: number; retryAfterSeconds: number | null }) => void;
}): Promise<Response> {
  const shopDomain = normalizeShopifyDomain(args.shopDomain);
  if (!shopDomain) throw new Error('Invalid Shopify shop domain');

  const base = new URL(`https://${shopDomain}`);
  const url = new URL(args.endpoint, base);
  if (url.protocol !== 'https:' || url.hostname !== shopDomain || url.port || url.username || url.password) {
    throw new Error('Shopify API URL escaped the connected shop boundary');
  }

  const versionMatch = url.pathname.match(/^\/admin\/api\/([^/]+)\//);
  const requestedVersion = versionMatch ? getShopifyApiVersion(versionMatch[1]) : null;
  if (requestedVersion && requestedVersion !== getShopifyApiVersion()) {
    throw new Error(`Shopify API URL version mismatch: expected ${getShopifyApiVersion()}, received ${requestedVersion}`);
  }
  const fetchImpl = args.fetchImpl || fetch;
  const sleep = args.sleep || defaultSleep;
  const max429Retries = Math.max(0, Math.min(args.max429Retries ?? 2, 2));
  const requestTimeoutMs = Math.max(1, Math.min(args.requestTimeoutMs ?? 30000, 120000));

  for (let attempt = 0; ; attempt++) {
    const signal = AbortSignal.timeout(requestTimeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: args.method || 'GET',
        headers: {
          'X-Shopify-Access-Token': args.accessToken,
          'Content-Type': 'application/json',
        },
        ...(args.body === undefined ? {} : { body: args.body }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw new Error(`Shopify API request timed out after ${requestTimeoutMs}ms`);
      throw error;
    }
    const retryAfterRaw = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterRaw === null ? null : Number(retryAfterRaw);
    args.onResponse?.({
      attempt,
      status: response.status,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
    });
    if (response.status === 429 && attempt < max429Retries) {
      const retryDelaySeconds = retryAfterSeconds === null ? 1 : retryAfterSeconds;
      if (!Number.isFinite(retryDelaySeconds) || retryDelaySeconds < 0 || retryDelaySeconds > 30) {
        throw new Error('Shopify returned an invalid or unsafe Retry-After value');
      }
      await response.body?.cancel().catch(() => undefined);
      await sleep(retryDelaySeconds * 1000);
      continue;
    }
    if (requestedVersion && response.ok) {
      const effectiveVersion = String(response.headers.get('X-Shopify-API-Version') || '').trim();
      if (!effectiveVersion) throw new Error('Shopify response omitted X-Shopify-API-Version');
      if (effectiveVersion !== requestedVersion) {
        throw new Error(`Shopify API version fall-forward detected: requested ${requestedVersion}, received ${effectiveVersion}`);
      }
    }
    return response;
  }
}

export type ShopifyCustomerJourneyUtm = {
  ready: boolean | null;
  landingSite: string;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
};

export async function fetchShopifyOrderCustomerJourneyUtms(args: {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  orderIds: string[];
  fetchImpl?: typeof fetch;
}): Promise<Map<string, ShopifyCustomerJourneyUtm>> {
  const ids = Array.from(new Set(args.orderIds.map(id => String(id || '').trim()).filter(Boolean)));
  if (ids.some(id => !/^gid:\/\/shopify\/Order\/\d+$/.test(id))) throw new Error('Invalid Shopify order GraphQL ID');

  const results = new Map<string, ShopifyCustomerJourneyUtm>();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const response = await shopifyAdminFetch({
      shopDomain: args.shopDomain,
      accessToken: args.accessToken,
      endpoint: `/admin/api/${getShopifyApiVersion(args.apiVersion)}/graphql.json`,
      method: 'POST',
      fetchImpl: args.fetchImpl,
      body: JSON.stringify({
        query: `query MetricMindOrderJourneyUtm($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              customerJourneySummary {
                ready
                firstVisit {
                  landingPage
                  utmParameters { campaign source medium }
                }
              }
            }
          }
        }`,
        variables: { ids: batch },
      }),
    });
    const json: any = await response.json().catch(() => ({}));
    if (!response.ok || json?.errors || !Array.isArray(json?.data?.nodes) || json.data.nodes.length !== batch.length) {
      const message = Array.isArray(json?.errors) ? json.errors.map((error: any) => String(error?.message || '')).filter(Boolean).join('; ') : '';
      throw new Error(message || 'Shopify customer journey attribution response is incomplete');
    }
    for (let index = 0; index < batch.length; index++) {
      const node = json.data.nodes[index];
      if (!node || String(node.id || '') !== batch[index]) throw new Error('Shopify customer journey attribution order mismatch');
      const summary = node.customerJourneySummary || null;
      const visit = summary?.firstVisit || null;
      const utm = visit?.utmParameters || {};
      results.set(batch[index], {
        ready: typeof summary?.ready === 'boolean' ? summary.ready : null,
        landingSite: String(visit?.landingPage || ''),
        utm_campaign: String(utm?.campaign || ''),
        utm_source: String(utm?.source || ''),
        utm_medium: String(utm?.medium || ''),
      });
    }
  }
  return results;
}

export async function isShopifyPartnerDevelopmentStore(args: {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const response = await shopifyAdminFetch({
    ...args,
    endpoint: `/admin/api/${getShopifyApiVersion(args.apiVersion)}/graphql.json`,
    method: 'POST',
    body: JSON.stringify({ query: 'query MetricMindShopPlan { shop { plan { partnerDevelopment } } }' }),
  });
  const json: any = await response.json().catch(() => ({}));
  if (!response.ok || json?.errors || typeof json?.data?.shop?.plan?.partnerDevelopment !== 'boolean') {
    throw new Error('Shopify development-store verification failed');
  }
  return json.data.shop.plan.partnerDevelopment;
}

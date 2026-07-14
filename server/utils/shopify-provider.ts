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

export function requireShopifyOrderScope(scopes: Iterable<string>): void {
  if (!hasRequiredShopifyOrderScope(scopes)) {
    throw new Error('Shopify access token is missing the required read_orders scope');
  }
}

export function requireShopifyRevenueScopes(scopes: Iterable<string>): void {
  const normalized = Array.from(scopes, scope => String(scope || '').trim().toLowerCase());
  requireShopifyOrderScope(normalized);
  if (!normalized.includes('read_all_orders')) {
    throw new Error('Shopify access token is missing the required read_all_orders scope');
  }
}

export function requireShopifyOrderWindowScopes(scopes: Iterable<string>, createdAtMin: string, now = Date.now()): void {
  const normalized = Array.from(scopes, scope => String(scope || '').trim().toLowerCase());
  requireShopifyOrderScope(normalized);
  const start = Date.parse(createdAtMin);
  if (!Number.isFinite(start)) throw new Error('Invalid Shopify order window start');
  if (now - start > 60 * 24 * 60 * 60 * 1000 && !normalized.includes('read_all_orders')) {
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

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function shopifyAdminFetch(args: {
  shopDomain: string;
  accessToken: string;
  endpoint: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  max429Retries?: number;
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

  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(url, {
      headers: {
        'X-Shopify-Access-Token': args.accessToken,
        'Content-Type': 'application/json',
      },
    });
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

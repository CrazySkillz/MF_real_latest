import { normalizeReportingTimeZone } from './reporting-timezone';

export type ShopifyConfirmedRevenueAmounts = {
  shopAmount: number;
  shopCurrency: string | null;
  presentmentAmount: number | null;
  presentmentCurrency: string | null;
};

const normalizeCurrencyCode = (value: unknown, label: string): string => {
  const currency = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`${label} currency is missing or invalid`);
  return currency;
};

export const resolveShopifyGa4RevenueCurrency = (
  amounts: ShopifyConfirmedRevenueAmounts[],
  campaignCurrency: unknown,
): string => {
  const expectedCurrency = normalizeCurrencyCode(campaignCurrency, 'Campaign');
  const currencies = new Set(amounts.map(amount => normalizeCurrencyCode(amount.shopCurrency, 'Shopify shop-money')));
  if (currencies.size > 1) {
    throw new Error(`Shopify shop-money contains multiple currencies: ${Array.from(currencies).sort().join(', ')}`);
  }
  const shopCurrency = currencies.size === 1 ? Array.from(currencies)[0] : expectedCurrency;
  if (shopCurrency !== expectedCurrency) {
    throw new Error(`Shopify shop-money currency ${shopCurrency} does not match campaign currency ${expectedCurrency}`);
  }
  return expectedCurrency;
};

const explicitNonRevenueStatuses = new Set([
  'pending',
  'authorized',
  'partially_paid',
  'refunded',
  'voided',
]);

const parseRequiredMoney = (value: unknown, field: string): number => {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(`Shopify order is missing ${field}`);
  }
  const amount = Number(String(value).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Shopify order has invalid ${field}`);
  }
  return amount;
};

const parseOptionalMoney = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const amount = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

export const getShopifyDiscountCodes = (order: any): string[] => {
  if (!Array.isArray(order?.discount_codes)) return [];
  return order.discount_codes
    .map((discount: any) => String(discount?.code || '').trim())
    .filter(Boolean);
};

const parseShopifyUpdatedAt = (order: any): number | null => {
  const raw = String(order?.updated_at || '').trim();
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) throw new Error('Shopify order has invalid updated_at');
  return timestamp;
};

export const deduplicateShopifyOrders = (orders: any[]): any[] => {
  const byId = new Map<string, any>();
  for (const order of orders) {
    const orderId = String(order?.id ?? '').trim();
    if (!orderId) throw new Error('Shopify order is missing id');
    const existing = byId.get(orderId);
    if (!existing) {
      byId.set(orderId, order);
      continue;
    }

    const existingUpdatedAt = parseShopifyUpdatedAt(existing);
    const nextUpdatedAt = parseShopifyUpdatedAt(order);
    if (existingUpdatedAt === null || nextUpdatedAt === null) {
      if (JSON.stringify(existing) !== JSON.stringify(order)) {
        throw new Error(`Shopify returned conflicting duplicate order ${orderId} without updated_at`);
      }
      continue;
    }
    if (nextUpdatedAt > existingUpdatedAt) byId.set(orderId, order);
    if (nextUpdatedAt === existingUpdatedAt && JSON.stringify(existing) !== JSON.stringify(order)) {
      throw new Error(`Shopify returned conflicting duplicate order ${orderId}`);
    }
  }
  return Array.from(byId.values());
};

export const getShopifyOrderReportingDate = (order: any, reportingTimeZone: any): string => {
  const raw = String(order?.created_at || '').trim();
  const timestamp = Date.parse(raw);
  if (!raw || !Number.isFinite(timestamp)) throw new Error('Shopify order has invalid created_at');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeReportingTimeZone(reportingTimeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

export const getShopifyOrderReportingDateWithinWindow = (
  order: any,
  reportingTimeZone: any,
  startDate: string,
  endDate: string,
): string => {
  const orderDate = getShopifyOrderReportingDate(order, reportingTimeZone);
  if (orderDate < startDate || orderDate > endDate) {
    throw new Error(`Shopify order ${String(order?.id ?? '')} date is outside the campaign reporting window`);
  }
  return orderDate;
};

export const getShopifyConfirmedRevenueAmounts = (order: any): ShopifyConfirmedRevenueAmounts | null => {
  if (typeof order?.test !== 'boolean') {
    throw new Error('Shopify order is missing test classification');
  }
  if (order.test || order?.cancelled_at) return null;

  const financialStatus = String(order?.financial_status || '').trim().toLowerCase();
  if (!financialStatus) throw new Error('Shopify order is missing financial_status');
  if (explicitNonRevenueStatuses.has(financialStatus)) return null;
  if (financialStatus !== 'paid' && financialStatus !== 'partially_refunded') {
    throw new Error(`Shopify order has unsupported financial_status: ${financialStatus}`);
  }

  const set = order?.current_total_price_set || {};
  const shopMoney = set?.shop_money || set?.shopMoney || null;
  const presentmentMoney = set?.presentment_money || set?.presentmentMoney || null;
  const shopAmount = parseRequiredMoney(shopMoney?.amount ?? order?.current_total_price, 'current_total_price');
  if (shopAmount === 0) return null;

  return {
    shopAmount,
    shopCurrency: String(shopMoney?.currency_code ?? order?.currency ?? '').trim().toUpperCase() || null,
    presentmentAmount: parseOptionalMoney(presentmentMoney?.amount),
    presentmentCurrency: String(presentmentMoney?.currency_code ?? order?.presentment_currency ?? '').trim().toUpperCase() || null,
  };
};

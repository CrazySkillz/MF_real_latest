export type ShopifyConfirmedRevenueAmounts = {
  shopAmount: number;
  shopCurrency: string | null;
  presentmentAmount: number | null;
  presentmentCurrency: string | null;
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

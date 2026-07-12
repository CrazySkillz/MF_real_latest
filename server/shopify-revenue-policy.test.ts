import { describe, expect, it } from 'vitest';
import { getShopifyConfirmedRevenueAmounts, getShopifyDiscountCodes } from './utils/shopify-revenue';

const order = (overrides: Record<string, unknown> = {}) => ({
  test: false,
  cancelled_at: null,
  financial_status: 'paid',
  total_price: '150.00',
  current_total_price: '100.00',
  current_total_price_set: {
    shop_money: { amount: '100.00', currency_code: 'usd' },
    presentment_money: { amount: '92.00', currency_code: 'eur' },
  },
  ...overrides,
});

describe('Shopify confirmed-revenue policy', () => {
  it('uses current total price for paid and partially refunded orders', () => {
    expect(getShopifyConfirmedRevenueAmounts(order())).toEqual({
      shopAmount: 100,
      shopCurrency: 'USD',
      presentmentAmount: 92,
      presentmentCurrency: 'EUR',
    });
    expect(getShopifyConfirmedRevenueAmounts(order({ financial_status: 'partially_refunded' })))
      .toMatchObject({ shopAmount: 100 });
  });

  it.each(['pending', 'authorized', 'partially_paid', 'refunded', 'voided'])(
    'excludes %s orders',
    financialStatus => {
      expect(getShopifyConfirmedRevenueAmounts(order({ financial_status: financialStatus }))).toBeNull();
    },
  );

  it('excludes test, cancelled, and zero-current-total orders', () => {
    expect(getShopifyConfirmedRevenueAmounts(order({ test: true }))).toBeNull();
    expect(getShopifyConfirmedRevenueAmounts(order({ cancelled_at: '2026-07-01T00:00:00Z' }))).toBeNull();
    expect(getShopifyConfirmedRevenueAmounts(order({
      current_total_price: '0.00',
      current_total_price_set: { shop_money: { amount: '0.00', currency_code: 'USD' } },
    }))).toBeNull();
  });

  it('fails closed when classification or current revenue is missing or unsupported', () => {
    expect(() => getShopifyConfirmedRevenueAmounts(order({ test: undefined })))
      .toThrow('missing test classification');
    expect(() => getShopifyConfirmedRevenueAmounts(order({ financial_status: undefined })))
      .toThrow('missing financial_status');
    expect(() => getShopifyConfirmedRevenueAmounts(order({ financial_status: 'expired' })))
      .toThrow('unsupported financial_status');
    expect(() => getShopifyConfirmedRevenueAmounts(order({
      current_total_price: undefined,
      current_total_price_set: undefined,
    }))).toThrow('missing current_total_price');
  });

  it('returns every non-empty discount code for attribution', () => {
    expect(getShopifyDiscountCodes({ discount_codes: [
      { code: 'FIRST' },
      { code: ' SECOND ' },
      { code: '' },
    ] })).toEqual(['FIRST', 'SECOND']);
  });
});

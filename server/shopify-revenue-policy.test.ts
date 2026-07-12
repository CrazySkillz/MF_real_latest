import { describe, expect, it } from 'vitest';
import { deduplicateShopifyOrders, getShopifyConfirmedRevenueAmounts, getShopifyDiscountCodes, getShopifyOrderReportingDate, getShopifyOrderReportingDateWithinWindow } from './utils/shopify-revenue';

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

  it('deduplicates by order ID and retains the newest provider state', () => {
    const older = { id: 42, updated_at: '2026-07-01T10:00:00Z', current_total_price: '100.00' };
    const newer = { id: 42, updated_at: '2026-07-02T10:00:00Z', current_total_price: '75.00' };
    expect(deduplicateShopifyOrders([older, newer, { id: 43 }])).toEqual([newer, { id: 43 }]);
  });

  it('fails closed for missing identity and ambiguous duplicate state', () => {
    expect(() => deduplicateShopifyOrders([{}])).toThrow('missing id');
    expect(() => deduplicateShopifyOrders([
      { id: 42, current_total_price: '100.00' },
      { id: 42, current_total_price: '75.00' },
    ])).toThrow('conflicting duplicate order 42 without updated_at');
    expect(() => deduplicateShopifyOrders([
      { id: 42, updated_at: '2026-07-01T10:00:00Z', current_total_price: '100.00' },
      { id: 42, updated_at: '2026-07-01T10:00:00Z', current_total_price: '75.00' },
    ])).toThrow('conflicting duplicate order 42');
  });

  it('converts created_at into the campaign reporting timezone', () => {
    const source = { created_at: '2026-07-01T23:30:00-04:00' };
    expect(getShopifyOrderReportingDate(source, 'America/New_York')).toBe('2026-07-01');
    expect(getShopifyOrderReportingDate(source, 'Europe/Amsterdam')).toBe('2026-07-02');
    expect(() => getShopifyOrderReportingDate({ created_at: 'not-a-date' }, 'UTC')).toThrow('invalid created_at');
  });

  it('fails closed instead of re-dating future or out-of-window orders', () => {
    expect(getShopifyOrderReportingDateWithinWindow(
      { id: 42, created_at: '2026-07-02T12:00:00Z' }, 'UTC', '2026-07-01', '2026-07-03',
    )).toBe('2026-07-02');
    expect(() => getShopifyOrderReportingDateWithinWindow(
      { id: 42, created_at: '2026-07-04T12:00:00Z' }, 'UTC', '2026-07-01', '2026-07-03',
    )).toThrow('outside the campaign reporting window');
    expect(() => getShopifyOrderReportingDateWithinWindow(
      { id: 42, created_at: '2026-06-30T12:00:00Z' }, 'UTC', '2026-07-01', '2026-07-03',
    )).toThrow('outside the campaign reporting window');
  });
});

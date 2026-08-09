const currencyCode = (value: unknown): string => String(value || "").trim().toUpperCase();

export function resolveHubspotRevenueCurrency(
  detectedCurrencies: Iterable<unknown>,
  missingCurrencyDealCount: number,
  accountCurrency: unknown,
): { currency: string; currencies: string[] } {
  const currencies = new Set(Array.from(detectedCurrencies, currencyCode).filter(Boolean));
  if (missingCurrencyDealCount > 0) {
    const fallback = currencyCode(accountCurrency);
    if (fallback) currencies.add(fallback);
  }
  const values = Array.from(currencies).sort();
  return { currency: values.length === 1 ? values[0] : "", currencies: values };
}

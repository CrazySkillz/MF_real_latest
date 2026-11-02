/**
 * Multi-Currency Support Utilities
 * Handles currency formatting, conversion, and validation
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
  flag: string;
}

/**
 * Supported currencies with their configurations
 */
export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    decimals: 2,
    flag: '🇺🇸',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
    decimals: 2,
    flag: '🇬🇧',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    decimals: 2,
    flag: '🇪🇺',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    locale: 'ja-JP',
    decimals: 0, // Yen doesn't use decimal places
    flag: '🇯🇵',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    locale: 'en-CA',
    decimals: 2,
    flag: '🇨🇦',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    locale: 'en-AU',
    decimals: 2,
    flag: '🇦🇺',
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN',
    decimals: 2,
    flag: '🇮🇳',
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    locale: 'zh-CN',
    decimals: 2,
    flag: '🇨🇳',
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    locale: 'pt-BR',
    decimals: 2,
    flag: '🇧🇷',
  },
  MXN: {
    code: 'MXN',
    symbol: 'MX$',
    name: 'Mexican Peso',
    locale: 'es-MX',
    decimals: 2,
    flag: '🇲🇽',
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    locale: 'de-CH',
    decimals: 2,
    flag: '🇨🇭',
  },
  SEK: {
    code: 'SEK',
    symbol: 'kr',
    name: 'Swedish Krona',
    locale: 'sv-SE',
    decimals: 2,
    flag: '🇸🇪',
  },
  NZD: {
    code: 'NZD',
    symbol: 'NZ$',
    name: 'New Zealand Dollar',
    locale: 'en-NZ',
    decimals: 2,
    flag: '🇳🇿',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    locale: 'en-SG',
    decimals: 2,
    flag: '🇸🇬',
  },
  HKD: {
    code: 'HKD',
    symbol: 'HK$',
    name: 'Hong Kong Dollar',
    locale: 'en-HK',
    decimals: 2,
    flag: '🇭🇰',
  },
};

/**
 * Get currency configuration
 */
export function getCurrencyConfig(currencyCode: string): CurrencyConfig {
  return SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES['USD'];
}

// Spend facts can contain provider micros. Sum their decimal strings exactly;
// round only the requested result, never each contributing campaign/day.
export function sumSpendAmounts(amounts: Array<string | number>, decimals: 2 | 6 = 2): string {
  const micros = amounts.reduce((total, amount) => {
    const text = typeof amount === 'number' && Number.isFinite(amount) ? amount.toFixed(6) : String(amount);
    const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(text);
    if (!match) throw new Error('Invalid spend amount');
    const value = BigInt(match[2]) * BigInt(1_000_000) + BigInt((match[3] || '').padEnd(6, '0'));
    return total + (match[1] ? -value : value);
  }, BigInt(0));
  const absolute = micros < BigInt(0) ? -micros : micros;
  const units = decimals === 2 ? (absolute + BigInt(5_000)) / BigInt(10_000) : absolute;
  const scale = BigInt(decimals === 2 ? 100 : 1_000_000);
  return `${micros < BigInt(0) && units !== BigInt(0) ? '-' : ''}${units / scale}.${String(units % scale).padStart(decimals, '0')}`;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number | string,
  currencyCode: string = 'USD',
  options?: {
    showSymbol?: boolean;
    showCode?: boolean;
    compact?: boolean;
  }
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return formatCurrency(0, currencyCode, options);
  }
  
  const config = getCurrencyConfig(currencyCode);
  const { showSymbol = true, showCode = false, compact = false } = options || {};
  
  // Format the number
  let formatted: string;
  
  if (compact && Math.abs(num) >= 1000) {
    // Compact notation for large numbers (e.g., $1.2K, $3.5M)
    if (Math.abs(num) >= 1000000) {
      formatted = `${(num / 1000000).toFixed(1)}M`;
    } else {
      formatted = `${(num / 1000).toFixed(1)}K`;
    }
  } else {
    // Standard formatting
    formatted = num.toLocaleString(config.locale, {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    });
  }
  
  // Add symbol and/or code
  if (showSymbol && showCode) {
    return `${config.symbol}${formatted} ${config.code}`;
  } else if (showSymbol) {
    return `${config.symbol}${formatted}`;
  } else if (showCode) {
    return `${formatted} ${config.code}`;
  } else {
    return formatted;
  }
}

/**
 * Parse a currency string to a number
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols, commas, and spaces
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validate currency code
 */
export function isValidCurrency(currencyCode: string): boolean {
  return currencyCode in SUPPORTED_CURRENCIES;
}

/**
 * Get list of all supported currencies for dropdowns
 */
export function getCurrencyOptions(): Array<{
  value: string;
  label: string;
  flag: string;
}> {
  return Object.values(SUPPORTED_CURRENCIES).map(currency => ({
    value: currency.code,
    label: `${currency.flag} ${currency.code} - ${currency.name}`,
    flag: currency.flag,
  }));
}

/**
 * Approximate currency conversion multipliers (relative to USD)
 * Note: In production, these should be fetched from a real-time exchange rate API
 * These are approximate values as of November 2024
 */
export const CURRENCY_TO_USD_MULTIPLIERS: Record<string, number> = {
  USD: 1.00,
  GBP: 1.27,   // £1 ≈ $1.27
  EUR: 1.09,   // €1 ≈ $1.09
  JPY: 0.0067, // ¥1 ≈ $0.0067
  CAD: 0.74,   // C$1 ≈ $0.74
  AUD: 0.65,   // A$1 ≈ $0.65
  INR: 0.012,  // ₹1 ≈ $0.012
  CNY: 0.14,   // ¥1 ≈ $0.14
  BRL: 0.20,   // R$1 ≈ $0.20
  MXN: 0.059,  // MX$1 ≈ $0.059
  CHF: 1.13,   // CHF 1 ≈ $1.13
  SEK: 0.096,  // kr 1 ≈ $0.096
  NZD: 0.61,   // NZ$1 ≈ $0.61
  SGD: 0.75,   // S$1 ≈ $0.75
  HKD: 0.13,   // HK$1 ≈ $0.13
};

/**
 * Convert amount from one currency to another (approximate)
 * Note: In production, use a real-time exchange rate API
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  const fromMultiplier = CURRENCY_TO_USD_MULTIPLIERS[fromCurrency] || 1;
  const toMultiplier = CURRENCY_TO_USD_MULTIPLIERS[toCurrency] || 1;
  
  // Convert to USD first, then to target currency
  const amountInUSD = amount * fromMultiplier;
  const convertedAmount = amountInUSD / toMultiplier;
  
  return parseFloat(convertedAmount.toFixed(2));
}

/**
 * Adjust benchmark thresholds based on currency
 * Used for performance indicators (e.g., CPA thresholds)
 */
export function adjustThresholdForCurrency(
  thresholdInUSD: number,
  targetCurrency: string
): number {
  if (targetCurrency === 'USD') {
    return thresholdInUSD;
  }
  
  return convertCurrency(thresholdInUSD, 'USD', targetCurrency);
}

/**
 * Format currency for input fields (removes formatting, keeps numbers only)
 */
export function formatCurrencyForInput(value: string): string {
  // Remove all non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^0-9.-]/g, '');
  
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join('')}`;
  }
  
  return cleaned;
}

/**
 * Format currency for display in input fields (with symbol but editable)
 */
export function formatCurrencyForDisplay(
  value: string | number,
  currencyCode: string = 'USD'
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return '';
  }
  
  const config = getCurrencyConfig(currencyCode);
  
  return num.toLocaleString(config.locale, {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });
}


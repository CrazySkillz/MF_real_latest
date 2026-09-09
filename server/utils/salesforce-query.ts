export const MAX_SALESFORCE_VALUE_SEARCH_LENGTH = 80;

export const isSafeSalesforceFieldPath = (value: string): boolean =>
  /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(value);

export const escapeSalesforceSoqlLikePrefix = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');

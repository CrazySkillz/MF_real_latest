import { assertProductionTokenEncryptionConfigured, decryptString, encryptString } from "./utils/tokenVault";

export type GoogleAdsOAuthCustomer = {
  id: string;
  descriptiveName?: string;
  manager?: boolean;
  currencyCode?: string;
  timeZone?: string;
};

const GOOGLE_ADS_PENDING_AUTH_TTL_MS = 10 * 60 * 1000;

export function buildGoogleAdsOAuthAuthorization(input: {
  campaignId: string;
  actorId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresIn?: number;
  customers: GoogleAdsOAuthCustomer[];
  spendOnly: boolean;
  now?: number;
}): unknown {
  assertProductionTokenEncryptionConfigured();
  return encryptString(JSON.stringify({
    campaignId: input.campaignId,
    actorId: input.actorId,
    expiresAt: (input.now ?? Date.now()) + GOOGLE_ADS_PENDING_AUTH_TTL_MS,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken || "",
    tokenExpiresIn: input.tokenExpiresIn || 3600,
    customers: input.customers,
    spendOnly: input.spendOnly,
  }));
}

export function resolveGoogleAdsOAuthAuthorization(input: {
  authorization: unknown;
  campaignId: string;
  actorId: string;
  customerId: string;
  now?: number;
}): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  customerName: string;
  managerAccountId?: string;
  customerCurrency: string;
  customerTimeZone: string;
  spendOnly: boolean;
} | null {
  assertProductionTokenEncryptionConfigured();
  let pending: any;
  try {
    pending = JSON.parse(decryptString(input.authorization as any));
  } catch {
    return null;
  }
  const selectedCustomer = Array.isArray(pending?.customers)
    ? pending.customers.find((customer: any) => String(customer?.id || "") === input.customerId)
    : null;
  if (
    String(pending?.campaignId || "") !== input.campaignId ||
    String(pending?.actorId || "") !== input.actorId ||
    !Number.isFinite(Number(pending?.expiresAt)) ||
    Number(pending.expiresAt) < (input.now ?? Date.now()) ||
    !String(pending?.accessToken || "") ||
    !selectedCustomer
  ) return null;

  return {
    accessToken: String(pending.accessToken),
    refreshToken: String(pending.refreshToken || ""),
    expiresIn: Number(pending.tokenExpiresIn || 3600),
    customerName: String(selectedCustomer.descriptiveName || `Account ${input.customerId}`),
    managerAccountId: selectedCustomer.manager ? String(selectedCustomer.id) : undefined,
    customerCurrency: String(selectedCustomer.currencyCode || "").trim().toUpperCase(),
    customerTimeZone: String(selectedCustomer.timeZone || "").trim(),
    spendOnly: pending.spendOnly === true,
  };
}

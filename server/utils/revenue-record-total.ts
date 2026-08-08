export type RevenueRecordGrainTotals = {
  aggregate: number;
  attributed: number;
  hasAggregate: boolean;
};

export const selectRevenueRecordTotal = ({ aggregate, attributed, hasAggregate }: RevenueRecordGrainTotals): number =>
  hasAggregate ? aggregate : attributed;

const currencyCode = (value: unknown) => String(value || '').trim().toUpperCase();

export const requiresGa4RevenueMaterializationCompleteness = (
  platformContext: unknown,
  startDate: string,
  endDate: string,
  today: string = new Date().toISOString().slice(0, 10),
): boolean => platformContext === 'ga4' && startDate === '1900-01-01' && endDate >= today;

export const assertGa4RevenueMaterializationComplete = (activeSources: any[], rows: any[]): void => {
  const representedSourceIds = new Set(
    rows
      .filter((row) => {
        const value = row?.revenue ?? row?.revenueRecords?.revenue;
        return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value));
      })
      .map((row) => String(row?.revenueSourceId ?? row?.revenueRecords?.revenueSourceId ?? '').trim())
      .filter(Boolean),
  );
  const missingSourceIds = activeSources
    .filter((source) => source?.isActive !== false)
    .map((source) => String(source?.id || '').trim())
    .filter((sourceId) => sourceId && !representedSourceIds.has(sourceId));
  if (missingSourceIds.length > 0) {
    throw Object.assign(new Error('Active GA4 revenue source has no materialized revenue record'), {
      code: 'GA4_REVENUE_MATERIALIZATION_INCOMPLETE',
      sourceIds: missingSourceIds,
    });
  }
};

export const assertGa4RevenueCurrencyIntegrity = (rows: any[], campaignCurrencyRaw: unknown): string => {
  const campaignCurrency = currencyCode(campaignCurrencyRaw || 'USD');
  for (const row of rows) {
    const recordCurrency = currencyCode(row?.currency ?? row?.revenueRecords?.currency);
    const sourceCurrency = currencyCode(row?.sourceCurrency ?? row?.revenueSources?.currency);
    if (recordCurrency !== campaignCurrency || sourceCurrency !== campaignCurrency) {
      throw Object.assign(new Error('Active GA4 revenue currency does not match the campaign currency'), {
        code: 'GA4_REVENUE_CURRENCY_INTEGRITY_ERROR',
      });
    }
  }
  return campaignCurrency;
};

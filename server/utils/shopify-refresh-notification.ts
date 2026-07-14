export const SHOPIFY_REFRESH_FAILURE_NOTIFICATION_KIND = 'shopify_revenue_refresh_failure';

export const parseShopifyRefreshNotificationMetadata = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object') return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export function findOpenShopifyRefreshFailureNotification(rows: any[], campaignId: string, sourceId: string) {
  return rows.find((row) => {
    const metadata = parseShopifyRefreshNotificationMetadata(row?.metadata);
    return String(row?.campaignId || '') === campaignId
      && metadata.kind === SHOPIFY_REFRESH_FAILURE_NOTIFICATION_KIND
      && String(metadata.sourceId || '') === sourceId
      && !metadata.resolvedAt
      && !metadata.dismissedAt;
  });
}

export function buildShopifyRefreshFailureNotification(args: {
  campaignId: string;
  campaignName?: string | null;
  sourceId: string;
  refreshRunId?: string | null;
  failureCode?: string | null;
  failedAt: string;
}) {
  return {
    title: 'Shopify revenue refresh failed',
    message: 'Last-good Shopify revenue was retained. Review the Shopify Revenue source before relying on freshness.',
    type: 'error',
    campaignId: args.campaignId,
    campaignName: args.campaignName || null,
    read: false,
    priority: 'high',
    metadata: JSON.stringify({
      kind: SHOPIFY_REFRESH_FAILURE_NOTIFICATION_KIND,
      platformContext: 'ga4',
      sourceType: 'shopify',
      sourceId: args.sourceId,
      refreshRunId: args.refreshRunId || null,
      failureCode: args.failureCode || 'SHOPIFY_REFRESH_FAILED',
      failedAt: args.failedAt,
      lastGoodRetained: true,
      actionUrl: `/campaigns/${args.campaignId}/ga4-metrics`,
    }),
  };
}

export function resolveShopifyRefreshFailureNotification(row: any, resolvedAt: string) {
  return {
    read: true,
    metadata: JSON.stringify({
      ...parseShopifyRefreshNotificationMetadata(row?.metadata),
      resolvedAt,
      resolutionReason: 'shopify_refresh_succeeded',
    }),
  };
}

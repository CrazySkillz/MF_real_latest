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

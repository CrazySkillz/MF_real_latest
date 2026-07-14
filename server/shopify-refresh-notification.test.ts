import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildShopifyRefreshFailureNotification,
  findOpenShopifyRefreshFailureNotification,
  parseShopifyRefreshNotificationMetadata,
  resolveShopifyRefreshFailureNotification,
} from './utils/shopify-refresh-notification';

describe('Shopify refresh failure notifications', () => {
  it('builds a campaign/source-scoped non-secret last-good warning', () => {
    const row = buildShopifyRefreshFailureNotification({
      campaignId: 'campaign-1', campaignName: 'Campaign', sourceId: 'source-1',
      refreshRunId: 'run-1', failureCode: 'HTTP_503', failedAt: '2026-07-14T10:00:00.000Z',
    });
    const metadata = parseShopifyRefreshNotificationMetadata(row.metadata);

    expect(row).toMatchObject({ type: 'error', priority: 'high', read: false, campaignId: 'campaign-1' });
    expect(metadata).toMatchObject({
      kind: 'shopify_revenue_refresh_failure', sourceId: 'source-1', refreshRunId: 'run-1',
      failureCode: 'HTTP_503', lastGoodRetained: true,
    });
    expect(row.message).not.toMatch(/token|secret|shpat_/i);
  });

  it('deduplicates by campaign/source and stops treating a recovered alert as open', () => {
    const first = { id: 'n1', ...buildShopifyRefreshFailureNotification({
      campaignId: 'campaign-1', sourceId: 'source-1', failedAt: '2026-07-14T10:00:00.000Z',
    }) };
    const other = { id: 'n2', ...buildShopifyRefreshFailureNotification({
      campaignId: 'campaign-2', sourceId: 'source-1', failedAt: '2026-07-14T10:00:00.000Z',
    }) };

    expect(findOpenShopifyRefreshFailureNotification([other, first], 'campaign-1', 'source-1')?.id).toBe('n1');
    const resolved = { ...first, ...resolveShopifyRefreshFailureNotification(first, '2026-07-14T11:00:00.000Z') };
    expect(findOpenShopifyRefreshFailureNotification([resolved], 'campaign-1', 'source-1')).toBeUndefined();
  });

  it('wires scheduler failure and recovery without changing reprocess success semantics', () => {
    const scheduler = readFileSync('server/auto-refresh-scheduler.ts', 'utf8');
    expect(scheduler).toContain('syncShopifyRefreshFailureNotification');
    expect(scheduler).toContain('failureCode: String(result.json?.code || `HTTP_${result.status || 500}`)');
    expect(scheduler).toContain('if (sourceId) await syncShopifyRefreshFailureNotification({ campaignId, sourceId, failed: false });');
    expect(scheduler).toContain('return false;');
    expect(scheduler).toContain('return true;');
  });

  it('shows an active Shopify refresh failure on the notification bell until resolved', () => {
    const navigation = readFileSync('client/src/components/layout/navigation.tsx', 'utf8');
    expect(navigation).toContain('metadata?.kind === "shopify_revenue_refresh_failure"');
    expect(navigation).toContain('!metadata?.resolvedAt && !metadata?.dismissedAt');
    expect(navigation).toContain('hasActiveKpiBenchmarkBreach || hasActiveShopifyRefreshFailure');
    expect(navigation).toContain('{hasActiveNotificationAttention && (');
  });
});

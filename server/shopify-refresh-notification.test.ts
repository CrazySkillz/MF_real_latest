import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Shopify exclusion from Notifications", () => {
  it("does not create Shopify notification rows during auto-refresh", () => {
    const scheduler = readFileSync("server/auto-refresh-scheduler.ts", "utf8");
    const helper = readFileSync("server/utils/shopify-refresh-notification.ts", "utf8");

    expect(scheduler).not.toContain("shopify-refresh-notification");
    expect(scheduler).not.toContain("syncShopifyRefreshFailureNotification");
    expect(scheduler).not.toContain("storage.createNotification");
    expect(helper).not.toContain("buildShopifyRefreshFailureNotification");
  });

  it("keeps Shopify rows out of the Notifications API and bell", () => {
    const routes = readFileSync("server/routes-oauth.ts", "utf8");
    const navigation = readFileSync("client/src/components/layout/navigation.tsx", "utf8");

    expect(routes).toContain("isStandaloneShopifyRefreshFailureNotification");
    expect(routes).toContain("!isNotificationDismissed(n) && !isStandaloneShopifyRefreshFailureNotification(n)");
    expect(routes).toContain("|| isStandaloneShopifyRefreshFailureNotification(n)) return null;");
    expect(navigation).not.toContain("hasActiveShopifyRefreshFailure");
    expect(navigation).not.toContain('metadata?.kind === "shopify_revenue_refresh_failure"');
    expect(navigation).toContain("const hasActiveNotificationAttention = hasActiveKpiBenchmarkBreach;");
  });

  it("deletes only the exact standalone Shopify notification kind", () => {
    const index = readFileSync("server/index.ts", "utf8");
    const migration = readFileSync("migrations/0016_remove_shopify_refresh_failure_notifications.sql", "utf8");
    const exactKind = /"kind"\s*:\s*"shopify_revenue_refresh_failure"/;

    expect(exactKind.test('{"kind":"shopify_revenue_refresh_failure","sourceId":"source-1"}')).toBe(true);
    expect(exactKind.test('{ "kind": "performance-alert", "kpiId": "kpi-1" }')).toBe(false);
    expect(exactKind.test('{ "kind": "benchmark-alert", "benchmarkId": "benchmark-1" }')).toBe(false);
    for (const source of [index, migration]) {
      expect(source).toContain("DELETE FROM notifications");
      expect(source).toContain("WHERE metadata IS NOT NULL");
      expect(source).toContain("shopify_revenue_refresh_failure");
      expect(source).not.toContain("DELETE FROM notifications;");
    }
  });
});

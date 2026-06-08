import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Instagram startup migration regression guard", () => {
  it("creates Instagram source tables before routes use them", () => {
    const index = readFileSync(join(process.cwd(), "server", "index.ts"), "utf-8");

    expect(index).toContain("CREATE TABLE IF NOT EXISTS instagram_connections");
    expect(index).toContain("CREATE INDEX IF NOT EXISTS idx_instagram_connections_campaign_id");
    expect(index).toContain("CREATE TABLE IF NOT EXISTS instagram_daily_metrics");
    expect(index).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_daily_metrics_unique");
    expect(index).toContain("CREATE INDEX IF NOT EXISTS idx_instagram_daily_metrics_campaign_date");
  });

  it("creates TikTok source tables before routes use them", () => {
    const index = readFileSync(join(process.cwd(), "server", "index.ts"), "utf-8");

    expect(index).toContain("CREATE TABLE IF NOT EXISTS tiktok_connections");
    expect(index).toContain("CREATE INDEX IF NOT EXISTS idx_tiktok_connections_campaign_id");
    expect(index).toContain("CREATE TABLE IF NOT EXISTS tiktok_daily_metrics");
    expect(index).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_daily_metrics_unique");
    expect(index).toContain("CREATE INDEX IF NOT EXISTS idx_tiktok_daily_metrics_campaign_date");
  });
});

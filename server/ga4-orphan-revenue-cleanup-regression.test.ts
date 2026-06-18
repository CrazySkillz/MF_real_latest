import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 orphan revenue cleanup regression guard", () => {
  it("deletes only the proven ga4_daily_metrics orphan revenue rows", () => {
    const migration = readFileSync(
      join(process.cwd(), "migrations", "0009_delete_ga4_daily_metrics_orphan_revenue_records.sql"),
      "utf-8"
    );

    expect(migration).toContain("DELETE FROM revenue_records rr");
    expect(migration).toContain("'5cc4657b-f4df-4709-8d10-5d9b7639633c'");
    expect(migration).toContain("'ec2552dc-cbcf-4d3b-b987-c61aa691bf82'");
    expect(migration).toContain("'6b6111cc-4d53-4e88-a41e-5386acbabe7a'");
    expect(migration).toContain("AND rr.campaign_id = '247d8ebf-9554-45b9-8a50-482ec25da5a7'");
    expect(migration).toContain("AND rr.revenue_source_id = 'ga4_daily_metrics'");
    expect(migration).toContain("NOT EXISTS");
    expect(migration).toContain("WHERE rs.id::text = rr.revenue_source_id");
    expect(migration).not.toContain("DELETE FROM revenue_records rr\n  WHERE rr.revenue_source_id = 'ga4_daily_metrics'");
  });
});

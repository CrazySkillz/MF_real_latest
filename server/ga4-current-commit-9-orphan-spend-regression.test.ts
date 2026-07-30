import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const readServerFile = (name: string) => readFileSync(join(process.cwd(), "server", name), "utf8");

describe("GA4 Overview Current Commit 9 orphan-spend forward guard", () => {
  it("keeps LinkedIn daily persistence without appending pseudo-source spend records", () => {
    const scheduler = readServerFile("linkedin-scheduler.ts");
    expect(scheduler).toContain("upsertLinkedInDailyTotals");
    expect(scheduler).toContain("storage.getLinkedInDailyMetrics");
    expect(scheduler).not.toContain("spendSourceId: 'linkedin_daily_metrics'");
  });

  it("keeps Meta daily persistence without appending pseudo-source spend records", () => {
    const scheduler = readServerFile("meta-scheduler.ts");
    expect(scheduler).toContain("storage.upsertMetaDailyMetrics");
    expect(scheduler).toContain("storage.getMetaDailyMetrics");
    expect(scheduler).not.toContain("spendSourceId: 'meta_daily_metrics'");
  });

  it("keeps generic spend totals source-backed so retained orphans remain excluded", () => {
    const storage = readServerFile("storage.ts");
    expect(storage).toContain(".innerJoin(spendSources, sql`${spendSources.id}::text = ${spendRecords.spendSourceId}`)");
    expect(storage).toContain("eq(spendSources.isActive, true)");
  });
});

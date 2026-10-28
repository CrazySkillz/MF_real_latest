import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";
import {
  runGoogleSheetsSpendAutoRefreshOnce, runGoogleSheetsRevenueAutoRefreshOnce,
  runHubSpotPipelineAutoRefreshOnce, runSalesforcePipelineAutoRefreshOnce,
} from "./auto-refresh-scheduler";

const jobs = [
  ["Sheets spend", runGoogleSheetsSpendAutoRefreshOnce, "__googleSheetsSpendRefreshInProgress"],
  ["Sheets revenue", runGoogleSheetsRevenueAutoRefreshOnce, "__googleSheetsSpendRefreshInProgress"],
  ["HubSpot", runHubSpotPipelineAutoRefreshOnce, "__salesforcePipelineRefreshInProgress"],
  ["Salesforce", runSalesforcePipelineAutoRefreshOnce, "__salesforcePipelineRefreshInProgress"],
] as const;
const flags = ["__ga4DailyRefreshInProgress", "__autoRefreshInProgress", "__googleSheetsSpendRefreshInProgress", "__salesforcePipelineRefreshInProgress"];
beforeEach(() => vi.stubEnv("GA4_DAILY_PIPELINE_OWNS_REFRESH", "false"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const flag of flags) delete (global as any)[flag]; });

describe.each(jobs)("%s scheduled GA4 ownership", (_name, run) => {
  it("does not read providers or mutate GA4 sources between scheduled runs", async () => {
    vi.stubEnv("GA4_DAILY_PIPELINE_OWNS_REFRESH", "true");
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "a", status: "active" }] as any);
    vi.spyOn(storage, "getSpendSources").mockResolvedValue([{ id: "s", campaignId: "a", isActive: true, sourceType: "google_sheets", platformContext: "ga4",
      mappingConfig: JSON.stringify({ connectionId: "g", spendColumn: "Spend", platformContext: "ga4" }) }] as any);
    const revenue = vi.spyOn(storage, "getRevenueSources");
    const connections = vi.spyOn(storage, "getGoogleSheetsConnections");
    const provider = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No interval provider request is allowed"));
    await run();
    expect(revenue).not.toHaveBeenCalled(); expect(connections).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
  });
});

describe.each(jobs)("%s interval admission during publication", (_name, run, ownFlag) => {
  it("waits for the full GA4 pipeline, including its post-provider publication stages", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const campaigns = vi.spyOn(storage, "getCampaigns").mockResolvedValue([]);
    // Financial provider processing has finished, but the GA4 owner is still publishing.
    (global as any).__ga4DailyRefreshInProgress = true;
    (global as any).__autoRefreshInProgress = false;
    await run();
    expect(campaigns).not.toHaveBeenCalled();
    expect((global as any).__ga4DailyRefreshInProgress).toBe(true);
    expect((global as any)[ownFlag]).toBeUndefined();
    (global as any).__ga4DailyRefreshInProgress = false;
    await run();
    expect(campaigns).toHaveBeenCalledTimes(1);
    expect((global as any)[ownFlag]).toBe(false);
  });

  it.each(flags.slice(1))("retains exclusion while %s is already busy", async flag => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const campaigns = vi.spyOn(storage, "getCampaigns").mockResolvedValue([]);
    (global as any)[flag] = true;
    await run();
    expect(campaigns).not.toHaveBeenCalled();
    expect((global as any)[flag]).toBe(true);
  });

  it("clears its own flag after discovery fails, allowing the next interval to recover", async () => {
    const campaigns = vi.spyOn(storage, "getCampaigns").mockRejectedValueOnce(new Error("fixture discovery failure")).mockResolvedValue([]);
    await expect(run()).rejects.toThrow("fixture discovery failure");
    expect((global as any)[ownFlag]).toBe(false);
    await run();
    expect(campaigns).toHaveBeenCalledTimes(2);
    expect((global as any)[ownFlag]).toBe(false);
  });
});

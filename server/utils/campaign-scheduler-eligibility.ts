export function filterActiveSchedulerCampaigns<T extends { status?: unknown }>(campaigns: T[]): T[] {
  return campaigns.filter((campaign) => String(campaign?.status || "").trim().toLowerCase() === "active");
}

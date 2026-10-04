export function filterActiveSchedulerCampaigns<T extends { id?: unknown; status?: unknown }>(campaigns: T[], includeDraftCampaignId = ""): T[] {
  return campaigns.filter((campaign) => {
    const status = String(campaign?.status || "").trim().toLowerCase();
    return status === "active" || (status === "draft" && String(campaign?.id || "") === includeDraftCampaignId);
  });
}

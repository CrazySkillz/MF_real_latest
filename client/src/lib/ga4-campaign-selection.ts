export function getSelectableGA4CampaignFilter(
  selected: string[],
  available: Array<{ name: string }>,
): string[] {
  if (available.length === 0) return selected;
  const selectedNames = new Set(selected);
  return available.map(campaign => campaign.name).filter(name => selectedNames.has(name));
}

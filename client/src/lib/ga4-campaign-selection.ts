export function getSelectableGA4CampaignFilter(
  selected: string[],
  available: Array<{ name: string }>,
  manual: string[] = [],
): string[] {
  if (available.length === 0) return selected;
  const selectedNames = new Set(selected);
  return Array.from(new Set([...available.map(campaign => campaign.name), ...manual])).filter(name => selectedNames.has(name));
}

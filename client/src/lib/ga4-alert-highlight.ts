export function dismissGA4AlertHighlightOnOutsideClick(
  target: EventTarget | null,
  href: string,
  findCard: (id: string) => Pick<Element, "contains"> | null,
  replaceUrl: (url: string) => void,
): boolean {
  const url = new URL(href);
  const highlightId = url.searchParams.get("highlight");
  const tab = url.searchParams.get("tab");
  if (!highlightId || !/^\/campaigns\/[^/]+\/ga4-metrics\/?$/.test(url.pathname)) return false;

  const prefix = tab === "kpis" ? "ga4-kpi-" : tab === "benchmarks" ? "ga4-benchmark-" : "";
  if (!prefix) return false;

  const highlightedCard = findCard(`${prefix}${highlightId}`);
  if (target && highlightedCard?.contains(target as Node)) return false;

  url.searchParams.delete("highlight");
  replaceUrl(`${url.pathname}${url.search}${url.hash}`);
  return true;
}

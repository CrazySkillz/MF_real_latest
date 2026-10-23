export const MAX_HUBSPOT_PAGES = 25;
export const HUBSPOT_PAGINATION_ERROR_CODE = 'HUBSPOT_PAGINATION_INCOMPLETE';

// Financial queries must be complete and contain each provider identity once.
// Repeated identities (even identical ones) invalidate the query; retry it as a whole.
export function validateHubspotSearchPage(json: any, state?: { total?: number; ids: Set<string> }): void {
  if (!Array.isArray(json?.results) || !Number.isSafeInteger(json?.total) || json.total < 0) {
    throw hubspotPaginationError('invalid search response');
  }
  const ids = state?.ids ?? new Set<string>();
  if (state && state.total !== undefined && state.total !== json.total) throw hubspotPaginationError('result count changed during pagination');
  if (state) state.total = json.total;
  for (const deal of json.results) {
    if (typeof deal?.id !== 'string' || !deal.id.trim() || !deal.properties || typeof deal.properties !== 'object' || Array.isArray(deal.properties)) throw hubspotPaginationError('missing deal identity or properties');
    if (ids.has(deal.id)) throw hubspotPaginationError('repeated deal identity');
    ids.add(deal.id);
  }
  const next = json?.paging?.next;
  if (next && !String(next.after ?? '').trim()) throw hubspotPaginationError('missing next cursor');
  if (state && (ids.size > json.total || (next ? ids.size >= json.total || json.results.length === 0 : ids.size !== json.total))) {
    throw hubspotPaginationError('result count does not match complete query');
  }
}

export const hubspotPaginationError = (reason: string): Error & { code: string } => Object.assign(
  new Error(`HubSpot returned more results than can be imported safely (${reason}). Narrow the filter or reduce the date range.`),
  { code: HUBSPOT_PAGINATION_ERROR_CODE },
);

export const nextHubspotPageCursor = (
  rawCursor: unknown,
  fetchedPages: number,
  requestedCursors: Set<string>,
): string | undefined => {
  const next = rawCursor === null || rawCursor === undefined ? '' : String(rawCursor).trim();
  if (!next) return undefined;
  if (fetchedPages >= MAX_HUBSPOT_PAGES) throw hubspotPaginationError(`page limit ${MAX_HUBSPOT_PAGES} reached with another page available`);
  if (requestedCursors.has(next)) throw hubspotPaginationError('provider repeated a paging cursor');
  requestedCursors.add(next);
  return next;
};

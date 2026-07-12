export const MAX_HUBSPOT_PAGES = 25;
export const HUBSPOT_PAGINATION_ERROR_CODE = 'HUBSPOT_PAGINATION_INCOMPLETE';

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

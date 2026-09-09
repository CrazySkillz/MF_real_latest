export const MAX_SALESFORCE_RESULTS = 5_000;
export const MAX_SALESFORCE_PAGES = 10;
export const SALESFORCE_PAGINATION_ERROR_CODE = 'SALESFORCE_PAGINATION_INCOMPLETE';
export const SALESFORCE_RESULT_LIMIT_ERROR_CODE = 'SALESFORCE_TOO_MANY_RESULTS';

type SalesforceQueryError = Error & { code: string; status?: number };

const queryError = (message: string, code: string, status?: number): SalesforceQueryError =>
  Object.assign(new Error(message), { code, ...(status ? { status } : {}) });

export async function fetchCompleteSalesforceQuery(args: {
  initialUrl: string;
  instanceUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  maxResults?: number;
  maxPages?: number;
}): Promise<any[]> {
  const fetchImpl = args.fetchImpl || fetch;
  const maxResults = args.maxResults ?? MAX_SALESFORCE_RESULTS;
  const maxPages = args.maxPages ?? MAX_SALESFORCE_PAGES;
  const instanceOrigin = new URL(args.instanceUrl).origin;
  const requestedUrls = new Set<string>();
  const records: any[] = [];
  let nextUrl: string | undefined = args.initialUrl;
  let pages = 0;

  while (nextUrl) {
    if (requestedUrls.has(nextUrl)) {
      throw queryError('Salesforce repeated a query locator.', SALESFORCE_PAGINATION_ERROR_CODE);
    }
    requestedUrls.add(nextUrl);

    const response = await fetchImpl(nextUrl, { headers: { Authorization: `Bearer ${args.accessToken}` } });
    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw queryError(
        String(json?.[0]?.message || json?.message || 'Failed to load Salesforce opportunities'),
        'SALESFORCE_QUERY_FAILED',
        response.status,
      );
    }

    records.push(...(Array.isArray(json?.records) ? json.records : []));
    if (records.length > maxResults) {
      throw queryError(
        `Too many matching Salesforce opportunities (>${maxResults.toLocaleString()}). Please narrow your filter or reduce the date range.`,
        SALESFORCE_RESULT_LIMIT_ERROR_CODE,
      );
    }

    pages += 1;
    const rawNextUrl = String(json?.nextRecordsUrl || '').trim();
    if (!rawNextUrl) {
      if (json?.done === false) {
        throw queryError('Salesforce reported incomplete query results without a next page.', SALESFORCE_PAGINATION_ERROR_CODE);
      }
      nextUrl = undefined;
      continue;
    }
    if (pages >= maxPages) {
      throw queryError(`Salesforce query page limit (${maxPages}) was reached before all results were returned.`, SALESFORCE_PAGINATION_ERROR_CODE);
    }

    const resolvedNextUrl = new URL(rawNextUrl, `${instanceOrigin}/`);
    if (resolvedNextUrl.origin !== instanceOrigin) {
      throw queryError('Salesforce returned a query locator for an unexpected host.', SALESFORCE_PAGINATION_ERROR_CODE);
    }
    nextUrl = resolvedNextUrl.toString();
  }

  return records;
}

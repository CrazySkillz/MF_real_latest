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
  signal?: AbortSignal;
}): Promise<any[]> {
  const fetchImpl = args.fetchImpl || fetch;
  const timeout = AbortSignal.timeout(120_000);
  const signal = args.signal ? AbortSignal.any([args.signal, timeout]) : timeout;
  const maxResults = args.maxResults ?? MAX_SALESFORCE_RESULTS;
  const maxPages = args.maxPages ?? MAX_SALESFORCE_PAGES;
  const instanceOrigin = new URL(args.instanceUrl).origin;
  const requestedUrls = new Set<string>();
  const records: any[] = [];
  const recordIds = new Set<string>();
  let expectedTotal: number | undefined;
  let nextUrl: string | undefined = args.initialUrl;
  let pages = 0;

  while (nextUrl) {
    signal.throwIfAborted();
    if (requestedUrls.has(nextUrl)) {
      throw queryError('Salesforce repeated a query locator.', SALESFORCE_PAGINATION_ERROR_CODE);
    }
    requestedUrls.add(nextUrl);

    const response = await fetchImpl(nextUrl, { headers: { Authorization: `Bearer ${args.accessToken}` }, signal });
    const json: any = await response.json();
    signal.throwIfAborted();
    if (!response.ok) {
      throw queryError(
        String(json?.[0]?.message || json?.message || 'Failed to load Salesforce opportunities'),
        'SALESFORCE_QUERY_FAILED',
        response.status,
      );
    }

    if (!Array.isArray(json?.records) || typeof json.done !== 'boolean' || !Number.isSafeInteger(json.totalSize) || json.totalSize < 0
      || (expectedTotal !== undefined && expectedTotal !== json.totalSize)) {
      throw queryError('Salesforce returned an invalid or changing query result.', SALESFORCE_PAGINATION_ERROR_CODE);
    }
    expectedTotal = json.totalSize;
    for (const record of json.records) {
      if (typeof record?.Id !== 'string' || !record.Id.trim() || recordIds.has(record.Id)) {
        throw queryError('Salesforce returned a missing or repeated record identity.', SALESFORCE_PAGINATION_ERROR_CODE);
      }
      recordIds.add(record.Id);
      records.push(record);
    }
    if (records.length > maxResults) {
      throw queryError(
        `Too many matching Salesforce opportunities (>${maxResults.toLocaleString()}). Please narrow your filter or reduce the date range.`,
        SALESFORCE_RESULT_LIMIT_ERROR_CODE,
      );
    }

    pages += 1;
    const rawNextUrl = String(json?.nextRecordsUrl || '').trim();
    if (records.length > json.totalSize || (json.done && (rawNextUrl || records.length !== json.totalSize))
      || (!json.done && (json.records.length === 0 || records.length >= json.totalSize))) {
      throw queryError('Salesforce query count or completion marker is inconsistent.', SALESFORCE_PAGINATION_ERROR_CODE);
    }
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

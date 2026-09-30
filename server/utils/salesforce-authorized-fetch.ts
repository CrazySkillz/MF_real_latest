type RefreshSalesforceAccessToken = (rejectedAccessToken: string) => Promise<string>;

export function createSalesforceAuthorizedFetch(args: {
  accessToken: string;
  fetchImpl: typeof fetch;
  refreshAccessToken: RefreshSalesforceAccessToken;
}): typeof fetch {
  let accessToken = args.accessToken;

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = (token: string) => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return args.fetchImpl(input, { ...init, headers });
    };

    let response = await request(accessToken);
    if (response.status !== 401) return response;

    const rejectedAccessToken = accessToken;
    const refreshedAccessToken = String(await args.refreshAccessToken(rejectedAccessToken) || "").trim();
    if (!refreshedAccessToken) throw new Error("Salesforce token refresh returned no access token");
    accessToken = refreshedAccessToken;
    response = await request(accessToken);
    return response;
  }) as typeof fetch;
}

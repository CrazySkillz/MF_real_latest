type DebugStep =
  | { method: 'Opportunity'; ok: boolean; value?: string | null; note?: string | null }
  | { method: 'Organization' | 'CompanyInfo' | 'CurrencyType' | 'User'; ok: boolean; field?: string; value?: string | null; status?: number; error?: string | null }
  | { method: 'userinfo'; ok: boolean; status?: number; error?: string | null; userId?: string | null };

export type DetectSalesforceCurrencyArgs = {
  accessToken: string;
  instanceUrl: string;
  apiVersion: string;
  authBase?: string; // login/test
  currenciesFromRecords?: Set<string>;
  debug?: boolean;
  fetchImpl?: typeof fetch;
};

export type DetectSalesforceCurrencyResult = {
  detectedCurrency: string | null;
  detectedCurrencies: string[];
  debugSteps?: DebugStep[];
};

const DEFAULT_AUTH_BASE = 'https://login.salesforce.com';
const SANDBOX_AUTH_BASE = 'https://test.salesforce.com';

function normCurrency(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase();
  return s ? s : null;
}

async function soqlQuery(fetchImpl: typeof fetch, args: { instanceUrl: string; apiVersion: string; accessToken: string; soql: string }) {
  const { instanceUrl, apiVersion, accessToken, soql } = args;
  const url = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(soql)}`;
  const resp = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json: any = await resp.json().catch(() => ({}));
  return { resp, json };
}

export async function detectSalesforceCurrency(args: DetectSalesforceCurrencyArgs): Promise<DetectSalesforceCurrencyResult> {
  const fetchImpl = args.fetchImpl || fetch;
  const steps: DebugStep[] = [];
  const inferredAuthBase =
    args.authBase ||
    process.env.SALESFORCE_AUTH_BASE_URL ||
    (String(args.instanceUrl || '').toLowerCase().includes('.sandbox.') ? SANDBOX_AUTH_BASE : DEFAULT_AUTH_BASE);
  const authBase = String(inferredAuthBase).replace(/\/+$/, '');

  // 0) If the Opportunity query returned a single currency, that's authoritative.
  const currenciesFromRecords = args.currenciesFromRecords || new Set<string>();
  const fromOpp = currenciesFromRecords.size === 1 ? Array.from(currenciesFromRecords)[0] : null;
  if (fromOpp) {
    const v = normCurrency(fromOpp);
    if (args.debug) steps.push({ method: 'Opportunity', ok: !!v, value: v, note: 'Single CurrencyIsoCode from records' });
    if (v) return { detectedCurrency: v, detectedCurrencies: Array.from(currenciesFromRecords).map((c) => String(c)) , ...(args.debug ? { debugSteps: steps } : {}) };
  }

  // 1) Org currency (Organization + CompanyInfo)
  const tryOrgLike = async (objectName: 'Organization' | 'CompanyInfo', fieldName: string): Promise<string | null> => {
    const soql = `SELECT ${fieldName} FROM ${objectName} LIMIT 1`;
    const { resp, json } = await soqlQuery(fetchImpl, {
      instanceUrl: args.instanceUrl,
      apiVersion: args.apiVersion,
      accessToken: args.accessToken,
      soql,
    });
    if (!resp.ok) {
      if (args.debug) steps.push({ method: objectName, field: fieldName, ok: false, status: resp.status, error: String(json?.[0]?.message || json?.message || null) });
      return null;
    }
    const rec = Array.isArray(json?.records) ? json.records[0] : null;
    const cur = normCurrency(rec?.[fieldName]);
    if (args.debug) steps.push({ method: objectName, field: fieldName, ok: !!cur, value: cur });
    return cur;
  };

  const orgCur =
    (await tryOrgLike('Organization', 'DefaultCurrencyIsoCode')) ||
    (await tryOrgLike('Organization', 'CurrencyIsoCode')) ||
    (await tryOrgLike('CompanyInfo', 'CurrencyIsoCode')) ||
    (await tryOrgLike('CompanyInfo', 'DefaultCurrencyIsoCode'));
  if (orgCur) return { detectedCurrency: orgCur, detectedCurrencies: [...Array.from(currenciesFromRecords), orgCur].filter(Boolean).map(String), ...(args.debug ? { debugSteps: steps } : {}) };

  // 2) Corporate currency via CurrencyType
  try {
    const soql = `SELECT IsoCode FROM CurrencyType WHERE IsCorporate = true LIMIT 1`;
    const { resp, json } = await soqlQuery(fetchImpl, {
      instanceUrl: args.instanceUrl,
      apiVersion: args.apiVersion,
      accessToken: args.accessToken,
      soql,
    });
    if (!resp.ok) {
      if (args.debug) steps.push({ method: 'CurrencyType', field: 'IsoCode', ok: false, status: resp.status, error: String(json?.[0]?.message || json?.message || null) });
    } else {
      const rec = Array.isArray(json?.records) ? json.records[0] : null;
      const cur = normCurrency(rec?.IsoCode);
      if (args.debug) steps.push({ method: 'CurrencyType', field: 'IsoCode', ok: !!cur, value: cur });
      if (cur) return { detectedCurrency: cur, detectedCurrencies: [...Array.from(currenciesFromRecords), cur].filter(Boolean).map(String), ...(args.debug ? { debugSteps: steps } : {}) };
    }
  } catch (e: any) {
    if (args.debug) steps.push({ method: 'CurrencyType', ok: false, error: e?.message || 'Exception' });
  }

  // 3) Identity-based user lookup (doesn't require userinfo; uses standard REST resource listing)
  try {
    const url = `${args.instanceUrl}/services/data/${args.apiVersion}`;
    const resp = await fetchImpl(url, { headers: { Authorization: `Bearer ${args.accessToken}` } });
    const json: any = await resp.json().catch(() => ({}));
    const identityUrl = typeof json?.identity === 'string' ? String(json.identity) : null;
    if (!resp.ok || !identityUrl) {
      if (args.debug) steps.push({ method: 'User', ok: false, error: !resp.ok ? `Failed to load services/data/${args.apiVersion}` : 'No identity URL in services data' });
    } else {
      const idResp = await fetchImpl(identityUrl, { headers: { Authorization: `Bearer ${args.accessToken}` } });
      const idJson: any = await idResp.json().catch(() => ({}));
      const userIdRaw = idJson?.user_id || idJson?.userId || null;
      const userIdStr = String(userIdRaw ?? '');
      const userId = userIdStr.includes('/') ? userIdStr.split('/').filter(Boolean).slice(-1)[0] : userIdStr;
      if (args.debug) steps.push({ method: 'User', ok: !!userId, value: userId || null });
      if (userId) {
        const soql = `SELECT CurrencyIsoCode FROM User WHERE Id = '${String(userId).replace(/'/g, "\\'")}' LIMIT 1`;
        const { resp: qResp, json: qJson } = await soqlQuery(fetchImpl, {
          instanceUrl: args.instanceUrl,
          apiVersion: args.apiVersion,
          accessToken: args.accessToken,
          soql,
        });
        if (!qResp.ok) {
          if (args.debug) steps.push({ method: 'User', field: 'CurrencyIsoCode', ok: false, status: qResp.status, error: String(qJson?.[0]?.message || qJson?.message || null) });
        } else {
          const rec = Array.isArray(qJson?.records) ? qJson.records[0] : null;
          const cur = normCurrency(rec?.CurrencyIsoCode);
          if (args.debug) steps.push({ method: 'User', field: 'CurrencyIsoCode', ok: !!cur, value: cur });
          if (cur) return { detectedCurrency: cur, detectedCurrencies: [...Array.from(currenciesFromRecords), cur].filter(Boolean).map(String), ...(args.debug ? { debugSteps: steps } : {}) };
        }
      }
    }
  } catch (e: any) {
    if (args.debug) steps.push({ method: 'User', ok: false, error: e?.message || 'Exception' });
  }

  // 4) Connected user's currency via userinfo + User query
  try {
    const tryUserInfo = async (base: string) => {
      const url = `${base.replace(/\/+$/, '')}/services/oauth2/userinfo`;
      const uiResp = await fetchImpl(url, { headers: { Authorization: `Bearer ${args.accessToken}` } });
      const uiJson: any = await uiResp.json().catch(() => ({}));
      if (!uiResp.ok) {
        if (args.debug) steps.push({ method: 'userinfo', ok: false, status: uiResp.status, error: String(uiJson?.error || uiJson?.message || null) });
        return null;
      }
      const userIdRaw = uiJson?.user_id || uiJson?.userId || null;
      const userIdStr = String(userIdRaw ?? '');
      const userId = userIdStr.includes('/') ? userIdStr.split('/').filter(Boolean).slice(-1)[0] : userIdStr;
      if (args.debug) steps.push({ method: 'userinfo', ok: true, userId: userId || null });
      return userId || null;
    };

    // Prefer auth base (login/test), but some org setups accept userinfo on instanceUrl; try both.
    const userId = (await tryUserInfo(authBase)) || (await tryUserInfo(args.instanceUrl));
    if (userId) {
      const soql = `SELECT CurrencyIsoCode FROM User WHERE Id = '${String(userId).replace(/'/g, "\\'")}' LIMIT 1`;
      const { resp, json } = await soqlQuery(fetchImpl, {
        instanceUrl: args.instanceUrl,
        apiVersion: args.apiVersion,
        accessToken: args.accessToken,
        soql,
      });
      if (!resp.ok) {
        if (args.debug) steps.push({ method: 'User', field: 'CurrencyIsoCode', ok: false, status: resp.status, error: String(json?.[0]?.message || json?.message || null) });
      } else {
        const rec = Array.isArray(json?.records) ? json.records[0] : null;
        const cur = normCurrency(rec?.CurrencyIsoCode);
        if (args.debug) steps.push({ method: 'User', field: 'CurrencyIsoCode', ok: !!cur, value: cur });
        if (cur) return { detectedCurrency: cur, detectedCurrencies: [...Array.from(currenciesFromRecords), cur].filter(Boolean).map(String), ...(args.debug ? { debugSteps: steps } : {}) };
      }
    }
  } catch (e: any) {
    if (args.debug) steps.push({ method: 'User', ok: false, error: e?.message || 'Exception' });
  }

  return { detectedCurrency: null, detectedCurrencies: Array.from(currenciesFromRecords).map(String), ...(args.debug ? { debugSteps: steps } : {}) };
}



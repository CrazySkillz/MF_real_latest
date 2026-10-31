// Exact new, empty draft. The two connection requests must be denied before saving.
(async () => {
  const m = /* GRANT_FIXTURE */ null, checks = [], callbacks = [];
  let limitedCalls = 0, remaining = 10;
  const check = (name, value) => { checks.push({ check: name, passed: !!value }); if (!value) throw Error('CHECK_FAILED'); };
  try {
    if (!m || location.origin !== 'https://marketforensics.onrender.com' || window.Clerk?.user?.id !== m.ownerId) throw Error('WRONG_ACCOUNT_OR_ORIGIN');
    const call = async (path, body, { signedOut = false, html = false, limited = false } = {}) => {
      if (window.Clerk?.user?.id !== m.ownerId) throw Error('ACCOUNT_CHANGED');
      if (limited && (limitedCalls >= 8 || remaining < 3)) throw Error('RATE_LIMIT_BUDGET');
      if (limited) limitedCalls++;
      const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: signedOut ? 'omit' : 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000), ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      if (limited) { const value = response.headers.get('ratelimit-remaining'); if (value !== null && /^\d+$/.test(value)) remaining = Number(value); }
      if (response.status === 429) throw Error('RATE_LIMIT_BUDGET');
      return { status: response.status, data: html ? await response.text() : await response.json() };
    };
    const target = await call(`/api/campaigns/${m.campaignId}`);
    check('exact empty owned draft', target.status === 200 && target.data.id === m.campaignId && target.data.ownerId === m.ownerId && target.data.clientId === m.clientId && target.data.name === m.tag && target.data.status === 'draft' && Number(target.data.spend) === 0);
    const ga4 = await call(`/api/campaigns/${m.campaignId}/ga4-service-account/connect`, { propertyId: m.resources.ga4, lookbackDays: 30 }, { limited: true });
    check('GA4 denies another client’s otherwise approved resource', ga4.status === 403 && ga4.data.error === 'SERVICE_ACCOUNT_RESOURCE_NOT_GRANTED');
    const sheets = await call(`/api/campaigns/${m.campaignId}/google-sheets-service-account/connect`, { spreadsheetId: m.resources.google_sheets, purpose: 'revenue' });
    check('Sheets denies a resource without this client’s permission', sheets.status === 403 && sheets.data.error === 'This provider resource is not approved for this customer');
    // Fresh signed states are kept only in this browser's memory. Never open the
    // provider URL: callback requests deliberately omit the user's session.
    for (const provider of ['ga4', 'google-sheets', 'hubspot', 'linkedin', 'meta']) {
      const start = await call(`/api/auth/${provider}/connect`, { campaignId: m.campaignId, purpose: 'revenue' }, { limited: true });
      if (['linkedin', 'meta'].includes(provider) && start.status === 500 && start.data.setupRequired === true) { callbacks.push({ provider, result: 'DEFERRED_PROVIDER_NOT_CONFIGURED' }); continue; }
      if (start.status !== 200 || typeof start.data.authUrl !== 'string') throw Error('STATE_START_FAILED');
      const state = new URL(start.data.authUrl).searchParams.get('state');
      if (!state || state.length > 4096) throw Error('INVALID_STATE_RESPONSE');
      const callback = provider === 'ga4' ? 'google-sheets' : provider;
      const response = await call(`/api/auth/${callback}/callback?code=${encodeURIComponent('B1_NO_PROVIDER_CODE_' + m.run)}&state=${encodeURIComponent(state)}`, undefined, { signedOut: true, html: true, limited: ['linkedin', 'meta'].includes(provider) });
      const passed = provider === 'ga4' ? response.status === 200 && response.data.includes('ga4_auth_error') && response.data.includes('Campaign not found.') && !response.data.includes('ga4_auth_success')
        : provider === 'google-sheets' ? response.status === 200 && response.data.includes('You must be signed in.') && !response.data.includes('sheets_auth_success')
        : response.status === 401 && /session expired|Unauthorized|sign.?in|authentication required/i.test(response.data);
      callbacks.push({ provider, status: response.status, result: passed ? 'PASS_VALID_STATE_WITHOUT_SESSION_DENIED' : 'CHECK_REQUIRED' });
      if (!passed) throw Error('CALLBACK_DENIAL_FAILED');
    }
    console.log(JSON.stringify({ batch1ResourceCheck: 'PASS_RESOURCE_DENIAL', run: m.run, clientId: m.clientId, campaignId: m.campaignId, checks, callbacks }, null, 2));
  } catch { console.log(JSON.stringify({ batch1ResourceCheck: 'CHECK_REQUIRED', run: m?.run, clientId: m?.clientId, campaignId: m?.campaignId, checks, callbacks }, null, 2)); }
})();

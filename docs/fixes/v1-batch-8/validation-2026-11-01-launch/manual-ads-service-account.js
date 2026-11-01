// One authorized browser check. Google reads only; app writes only to this disposable draft.
// No campaign activation, Spend-source import, mappings, ad changes or automatic retry.
(async () => {
  const ownerId = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl';
  const clientId = 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220';
  const referenceId = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
  const campaignId = 'b89ead82-29a3-4671-b281-66756051f966';
  const customerId = '4951281615', name = 'B1_ADS_SA_' + campaignId;
  const marker = 'mimo-ads-sa-' + campaignId, checks = [];
  let phase = 'preflight', httpStatus, providerCode, previewRows, cleanup = false;
  const check = (ok, code) => { if (!ok) throw Error(code); };
  const identity = () => {
    check(location.origin === 'https://app.mimosaas.app', 'OPEN_PRODUCTION_APP');
    check(window.Clerk?.user?.id === ownerId && window.Clerk?.session, 'USE_SECOND_ACCOUNT');
  };
  const report = (result, code) => {
    const value = { googleAdsServiceAccount: result, at: new Date().toISOString(), campaignId, customerId, phase, checks,
      ...(code ? { code } : {}), ...(httpStatus ? { httpStatus } : {}), ...(providerCode ? { providerCode } : {}),
      ...(previewRows !== undefined ? { previewRows } : {}), cleanup };
    console.log(JSON.stringify(value, null, 2));
    return value;
  };
  const request = async (url, method = 'GET', body) => {
    identity(); const token = await window.Clerk.session.getToken(); identity(); check(token, 'SIGN_IN_REQUIRED');
    const response = await fetch(url, { method, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(180000), headers: { Authorization: 'Bearer ' + token, Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    identity(); httpStatus = response.status;
    const data = await response.json();
    if (!response.ok) {
      // Never print raw provider responses, account details or credentials.
      providerCode = typeof data?.error === 'string' && /^[A-Z][A-Z0-9_]{2,100}$/.test(data.error) ? data.error : undefined;
      throw Error('REQUEST_FAILED');
    }
    return data;
  };
  const verifyDraft = async () => {
    const c = await request('/api/campaigns/' + campaignId);
    check(c.id === campaignId && c.ownerId === ownerId && c.clientId === clientId && c.name === name && c.status === 'draft'
      && c.currency === 'EUR' && c.reportingTimeZone === 'Europe/Amsterdam' && Number(c.spend) === 0
      && c.impressions === 0 && c.clicks === 0 && c.startDate?.slice(0, 10) === '2026-10-25', 'DRAFT_SCOPE_CHANGED');
  };
  const verifyConnection = async () => {
    const c = await request('/api/google-ads/' + campaignId + '/connection?spendPreview=1');
    check(c.connected === true && c.customerId === customerId && c.method === 'service_account' && c.currency === 'EUR', 'CONNECTION_MISMATCH');
  };
  const preview = async () => {
    const data = await request('/api/google-ads/' + campaignId + '/daily-metrics?startDate=2026-10-25&endDate=2026-10-31&spendPreview=1');
    check(data.success === true && Array.isArray(data.metrics) && data.currency === 'EUR', 'PREVIEW_INVALID');
    check(data.metrics.every(row => row.campaignId === campaignId && row.date >= '2026-10-25' && row.date <= '2026-10-31'
      && row.spend !== null && row.spend !== undefined && Number.isFinite(Number(row.spend))), 'PREVIEW_SCOPE_INVALID');
    previewRows = data.metrics.length;
  };
  try {
    identity(); check(Date.now() < Date.parse('2026-11-03T00:00:00Z'), 'CHECK_EXPIRED');
    const previous = sessionStorage.getItem(marker);
    if (previous) { console.log(previous); return; }
    check(!window[marker], 'CHECK_ALREADY_RUNNING');
    window[marker] = true;
    const reference = await request('/api/campaigns/' + referenceId);
    check(reference.id === referenceId && reference.ownerId === ownerId && reference.clientId === clientId && reference.name === 'Batch 1 Provider Check'
      && reference.status === 'active' && reference.currency === 'EUR' && reference.reportingTimeZone === 'Europe/Amsterdam', 'REFERENCE_SCOPE_CHANGED');
    const availability = await request('/api/campaigns/' + referenceId + '/google-ads-service-account/status');
    check(availability.success === true && availability.enabled === true, 'SERVICE_ACCOUNT_UNAVAILABLE');
    // Durable marker before the first write: repeating the paste cannot create or connect again.
    sessionStorage.setItem(marker, JSON.stringify({ googleAdsServiceAccount: 'IN_PROGRESS', campaignId, customerId, code: 'DO_NOT_RERUN_CHECK_RESULT' }));
    phase = 'create_draft';
    const created = await request('/api/campaigns', 'POST', { creationRequestId: campaignId, clientId, name, status: 'draft',
      platform: 'google_analytics', type: 'campaign', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam',
      budget: '0', spend: '0', impressions: 0, clicks: 0, startDate: '2026-10-25T00:00:00.000Z' });
    check(created.id === campaignId, 'CREATED_DRAFT_MISMATCH'); await verifyDraft();
    const empty = await request('/api/google-ads/' + campaignId + '/connection?spendPreview=1');
    check(empty.connected === false, 'DRAFT_ALREADY_CONNECTED'); checks.push('exact owned empty draft');
    phase = 'connect'; await verifyDraft();
    const connected = await request('/api/campaigns/' + campaignId + '/google-ads-service-account/connect', 'POST', { customerId });
    check(connected.success === true && connected.customer?.id === customerId && connected.method === 'service_account', 'CONNECT_RESULT_INVALID');
    checks.push('service-account connection');
    phase = 'reload_preview'; await verifyConnection(); await preview(); checks.push('persisted connection and scoped preview');
    phase = 'refresh'; await verifyDraft();
    const refreshed = await request('/api/google-ads/' + campaignId + '/refresh?spendPreview=1', 'POST');
    check(refreshed.success === true && refreshed.providerRefreshed === true && refreshed.spendMaterialization?.updated === false
      && refreshed.spendMaterialization.sourceId === null && refreshed.spendMaterialization.records === 0, 'REFRESH_RESULT_INVALID');
    await verifyConnection(); await preview(); await verifyDraft(); checks.push('provider refresh without Spend-source import');
    phase = 'cleanup';
    const removed = await request('/api/campaigns/' + campaignId + '?draftCleanup=1&clientId=' + clientId, 'DELETE');
    check(removed.success === true, 'CLEANUP_FAILED'); cleanup = true; checks.push('exact disposable draft cleanup');
    phase = 'complete';
    const result = report('PASS_ADS_SERVICE_ACCOUNT'); sessionStorage.setItem(marker, JSON.stringify(result, null, 2));
  } catch (error) {
    const known = /^(OPEN_PRODUCTION_APP|USE_SECOND_ACCOUNT|SIGN_IN_REQUIRED|REQUEST_FAILED|DRAFT_SCOPE_CHANGED|CONNECTION_MISMATCH|PREVIEW_INVALID|PREVIEW_SCOPE_INVALID|CHECK_EXPIRED|CHECK_ALREADY_RUNNING|REFERENCE_SCOPE_CHANGED|SERVICE_ACCOUNT_UNAVAILABLE|CREATED_DRAFT_MISMATCH|DRAFT_ALREADY_CONNECTED|CONNECT_RESULT_INVALID|REFRESH_RESULT_INVALID|CLEANUP_FAILED)$/;
    const result = report('CHECK_REQUIRED', known.test(error.message) ? error.message : 'REQUEST_INCOMPLETE');
    if (window[marker]) sessionStorage.setItem(marker, JSON.stringify(result, null, 2));
  }
})();

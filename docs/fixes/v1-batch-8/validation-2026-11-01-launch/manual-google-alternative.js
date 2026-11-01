// Combined exact-resource connection checks in one disposable draft. No imports or activation.
(async () => {
  const ownerId = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl', clientId = 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220';
  const referenceId = '36631f9f-5f32-4ae6-8d20-d8430abb364c', campaignId = '8798ff85-8850-473f-b8ff-6c6b43d5726a';
  const propertyId = '542352127', spreadsheetId = '1VMN6f089lsPISQ80pxT8Sq4awNU71-jQh5OgyFTXSeU', sheetName = 'Client_ROI_Summary';
  const name = 'B1_GOOGLE_SA_' + campaignId, marker = 'mimo-google-sa-' + campaignId, checks = [];
  let phase = 'preflight', cleanup = false, sheetConnectionId;
  const check = (ok, code) => { if (!ok) throw Error(code); };
  const identity = () => {
    check(location.origin === 'https://app.mimosaas.app', 'OPEN_PRODUCTION_APP');
    check(window.Clerk?.user?.id === ownerId && window.Clerk?.session, 'USE_SECOND_ACCOUNT');
  };
  const report = (result, code) => {
    const value = { googleAlternative: result, at: new Date().toISOString(), campaignId, phase, checks, cleanup,
      ...(sheetConnectionId ? { sheetConnectionId } : {}), ...(code ? { code } : {}) };
    console.log(JSON.stringify(value, null, 2)); return value;
  };
  const request = async (url, method = 'GET', body) => {
    identity(); const token = await window.Clerk.session.getToken(); identity(); check(token, 'SIGN_IN_REQUIRED');
    const response = await fetch(url, { method, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(180000), headers: { Authorization: 'Bearer ' + token, Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    identity(); const data = await response.json();
    if (!response.ok) {
      let code = typeof data?.error === 'string' && /^[A-Z][A-Z0-9_]{2,100}$/.test(data.error) ? data.error : 'REQUEST_FAILED';
      if (typeof data?.error === 'string' && /^Share this spreadsheet with .+ as Viewer, then try again\.$/.test(data.error)) code = 'SHEETS_VIEWER_ACCESS_REQUIRED';
      throw Object.assign(Error(code), { safeCode: code, httpStatus: response.status });
    }
    return data;
  };
  const draft = async () => {
    const c = await request('/api/campaigns/' + campaignId);
    check(c.id === campaignId && c.ownerId === ownerId && c.clientId === clientId && c.name === name && c.status === 'draft'
      && c.currency === 'EUR' && c.reportingTimeZone === 'Europe/Amsterdam' && Number(c.spend) === 0
      && c.impressions === 0 && c.clicks === 0, 'DRAFT_SCOPE_CHANGED');
  };
  const ga4Reload = async () => {
    const saved = await request('/api/campaigns/' + campaignId + '/ga4-connection-status');
    check(saved.connected === true && saved.propertyId === propertyId && saved.isRealOAuth === false && saved.pending === false
      && Array.isArray(saved.properties) && saved.properties.length === 1 && saved.properties[0].id === propertyId, 'GA4_RELOAD_MISMATCH');
  };
  const sheetsReload = async () => {
    const saved = await request('/api/campaigns/' + campaignId + '/google-sheets-connections?purpose=revenue');
    check(saved.success === true && Array.isArray(saved.connections) && saved.connections.length === 1, 'SHEETS_RELOAD_MISMATCH');
    const c = saved.connections[0];
    check(c.id === sheetConnectionId && c.spreadsheetId === spreadsheetId && c.sheetName === sheetName && c.isActive === true, 'SHEETS_RELOAD_MISMATCH');
  };
  const safeError = error => error.safeCode || (/^[A-Z][A-Z0-9_]{2,100}$/.test(error.message) ? error.message : 'REQUEST_INCOMPLETE');
  try {
    identity(); check(Date.now() < Date.parse('2026-11-03T00:00:00Z'), 'CHECK_EXPIRED');
    const previous = sessionStorage.getItem(marker); if (previous) { console.log(previous); return; }
    check(!window[marker], 'CHECK_ALREADY_RUNNING'); window[marker] = true;
    const reference = await request('/api/campaigns/' + referenceId);
    check(reference.id === referenceId && reference.ownerId === ownerId && reference.clientId === clientId
      && reference.name === 'Batch 1 Provider Check' && reference.status === 'active', 'REFERENCE_SCOPE_CHANGED');
    const oldGa4 = await request('/api/campaigns/' + referenceId + '/ga4-connection-status');
    check(oldGa4.connected === true && oldGa4.propertyId === propertyId, 'REFERENCE_PROPERTY_CHANGED');
    const oldSheets = await request('/api/campaigns/' + referenceId + '/google-sheets-connections?purpose=revenue');
    check(oldSheets.success === true && oldSheets.connections?.some(c => c.spreadsheetId === spreadsheetId && c.sheetName === sheetName), 'REFERENCE_SHEET_CHANGED');
    sessionStorage.setItem(marker, JSON.stringify({ googleAlternative: 'IN_PROGRESS', campaignId, code: 'DO_NOT_RERUN_CHECK_RESULT' }));
    phase = 'create_draft';
    const created = await request('/api/campaigns', 'POST', { creationRequestId: campaignId, clientId, name, status: 'draft',
      platform: 'google_analytics', type: 'campaign', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam',
      budget: '0', spend: '0', impressions: 0, clicks: 0 });
    check(created.id === campaignId, 'CREATED_DRAFT_MISMATCH'); await draft();
    for (const provider of ['ga4', 'google_sheets']) {
      try {
        phase = provider + '_connect'; await draft();
        const route = provider === 'ga4' ? 'ga4-service-account' : 'google-sheets-service-account';
        const availability = await request('/api/campaigns/' + campaignId + '/' + route + '/status');
        check(availability.enabled === true, 'SERVICE_ACCOUNT_UNAVAILABLE');
        if (provider === 'ga4') {
          const connected = await request('/api/campaigns/' + campaignId + '/' + route + '/connect', 'POST', { propertyId, lookbackDays: 30 });
          check(connected.success === true && connected.property?.id === propertyId && connected.method === 'service_account', 'GA4_CONNECT_MISMATCH');
          await ga4Reload(); phase = 'ga4_property_selection'; await draft();
          const selected = await request('/api/campaigns/' + campaignId + '/ga4-property', 'POST', { propertyId, lookbackDays: 30 });
          check(selected.success === true && selected.selectedProperty?.id === propertyId, 'GA4_SELECTION_MISMATCH');
          await ga4Reload(); checks.push({ provider, passed: true, checks: ['Google data-read permission', 'saved property reload', 'wizard property selection'] });
        } else {
          const connected = await request('/api/campaigns/' + campaignId + '/' + route + '/connect', 'POST', { spreadsheetId, purpose: 'revenue' });
          check(connected.success === true && connected.spreadsheet?.id === spreadsheetId
            && connected.sheets?.some(sheet => sheet.title === sheetName), 'SHEETS_CONNECT_MISMATCH');
          phase = 'sheets_tab_selection'; await draft();
          const selected = await request('/api/google-sheets/select-spreadsheet-multiple', 'POST', { campaignId, spreadsheetId,
            sheetNames: [sheetName], selectionMode: 'replace', purpose: 'revenue' });
          check(selected.success === true && selected.selectedSpreadsheet?.id === spreadsheetId && selected.sheetsConnected === 1
            && selected.sheetNames?.length === 1 && selected.sheetNames[0] === sheetName && selected.connectionIds?.length === 1
            && typeof selected.connectionIds[0] === 'string', 'SHEETS_SELECTION_MISMATCH');
          sheetConnectionId = selected.connectionIds[0]; await sheetsReload(); phase = 'sheets_preview';
          const preview = await request('/api/campaigns/' + campaignId + '/revenue/sheets/preview', 'POST', { connectionId: sheetConnectionId, platformContext: 'ga4' });
          check(preview.success === true && preview.connectionId === sheetConnectionId && preview.spreadsheetId === spreadsheetId
            && preview.sheetName === sheetName && Array.isArray(preview.headers) && preview.headers.includes('Revenue')
            && preview.headers.includes('Date') && Number.isInteger(preview.rowCount) && preview.rowCount > 0, 'SHEETS_PREVIEW_MISMATCH');
          await sheetsReload(); checks.push({ provider, passed: true, checks: ['shared spreadsheet permission', 'exact tab selection and reload', 'Google data preview'], previewRows: preview.rowCount });
        }
      } catch (error) {
        identity(); checks.push({ provider, passed: false, phase, code: safeError(error), ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}) });
        if (safeError(error) === 'DRAFT_SCOPE_CHANGED') throw error;
      }
    }
    await draft();
    if (checks.length === 2 && checks.every(item => item.passed)) {
      phase = 'cleanup'; const removed = await request('/api/campaigns/' + campaignId + '?draftCleanup=1&clientId=' + clientId, 'DELETE');
      check(removed.success === true, 'CLEANUP_FAILED'); cleanup = true; phase = 'complete';
    } else phase = 'awaiting_review';
    const result = report(cleanup ? 'PASS_GOOGLE_ALTERNATIVE' : 'CHECK_REQUIRED'); sessionStorage.setItem(marker, JSON.stringify(result, null, 2));
  } catch (error) {
    const result = report('CHECK_REQUIRED', safeError(error));
    if (window[marker]) sessionStorage.setItem(marker, JSON.stringify(result, null, 2));
  }
})();

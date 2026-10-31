// One bounded pass through the existing connection metadata endpoints.
// No imports, reconnects, mapping changes, forced expiry or schedule changes.
// The server may renew an expired credential through its normal connection flow.
(async () => {
  const campaign = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
  const checks = [], startedAt = new Date().toISOString();
  const requireCheck = (ok, code) => { if (!ok) throw Error(code); };
  const accountHash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2, '0')).join('');
  try {
    requireCheck(location.origin === 'https://marketforensics.onrender.com', 'WRONG_ORIGIN');
    const actor = window.Clerk?.user?.id;
    requireCheck(typeof actor === 'string' && await accountHash(actor) === '1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096', 'USE_SECOND_ACCOUNT');
    const request = async path => {
      requireCheck(window.Clerk?.user?.id === actor, 'ACCOUNT_CHANGED');
      const response = await fetch(path, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(45000) });
      const data = await response.json();
      return { status: response.status, data };
    };
    const target = await request(`/api/campaigns/${campaign}`);
    requireCheck(target.status === 200 && target.data.id === campaign && target.data.ownerId === actor && target.data.name === 'Batch 1 Provider Check' && target.data.status === 'active', 'TARGET_MISMATCH');
    const paths = [
      ['GA4', `/api/campaigns/${campaign}/ga4-connection-status`, data => data.connected === true && data.pending !== true && Array.isArray(data.properties) && data.properties.some(p => String(p.id) === String(data.propertyId))],
      ['Google Sheets', `/api/google-sheets/${campaign}/spreadsheets?purpose=revenue`, data => Array.isArray(data.spreadsheets) && data.spreadsheets.length > 0],
      ['HubSpot', `/api/hubspot/${campaign}/deals/properties`, data => data.success === true && Array.isArray(data.properties) && data.properties.some(p => p.name === 'dealname')],
      ['Salesforce', `/api/salesforce/${campaign}/opportunities/fields`, data => data.success === true && Array.isArray(data.fields) && data.fields.some(p => p.name === 'Amount')],
      ['Shopify', `/api/shopify/${campaign}/debug`, data => data.success === true && data.canReadOrders === true],
    ];
    // The second read checks the persisted credential path again; it does not force renewal.
    for (const pass of [1, 2]) for (const [provider, path, accepted] of paths) {
      const response = await request(path);
      const passed = response.status === 200 && accepted(response.data);
      checks.push({ provider, pass, status: response.status, passed });
      requireCheck(passed, 'PROVIDER_CHECK_FAILED');
    }
    console.log(JSON.stringify({ batch1ProviderReload: 'PASS_PROVIDER_RELOAD', startedAt, finishedAt: new Date().toISOString(), checks }, null, 2));
  } catch (error) {
    const allowed = ['WRONG_ORIGIN', 'USE_SECOND_ACCOUNT', 'ACCOUNT_CHANGED', 'TARGET_MISMATCH', 'PROVIDER_CHECK_FAILED'];
    console.log(JSON.stringify({ batch1ProviderReload: 'CHECK_REQUIRED', startedAt, checks, code: allowed.includes(error?.message) ? error.message : 'REQUEST_INCOMPLETE' }, null, 2));
  }
})();

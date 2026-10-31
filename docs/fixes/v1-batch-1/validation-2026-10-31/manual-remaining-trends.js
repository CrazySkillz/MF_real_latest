// Read-only remaining Trends access check. Run once per known app account.
// Never prints campaign contents, credentials, report names or provider responses.
(async () => {
  const origin = 'https://marketforensics.onrender.com';
  const campaignId = 'b74f98af-ede9-47af-9b19-0720ebb4d2c0';
  const ownerId = 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U';
  if (location.origin !== origin) throw Error();
  const actor = window.Clerk?.user?.id;
  if (!actor) throw Error();
  const owner = actor === ownerId;
  if (!owner) {
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(actor)))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (hash !== '1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096') throw Error();
  }
  const read = async path => {
    const r = await fetch(path, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    return { status: r.status, data: await r.json() };
  };
  if (owner) {
    const c = await read(`/api/campaigns/${campaignId}`);
    if (c.status !== 200 || c.data.id !== campaignId || c.data.ownerId !== ownerId) throw Error();
    // The actual route returns before importing the Trends provider only here.
    if (c.data.trendKeywords != null && (!Array.isArray(c.data.trendKeywords) || c.data.trendKeywords.length !== 0)) {
      console.log('B1 Trends: NOT_RUN — keywords configured; no provider request sent.');
      return;
    }
  }
  const r = await read(`/api/campaigns/${campaignId}/google-trends`);
  const passed = owner
    ? r.status === 400 && r.data.message === 'No trend keywords configured for this campaign'
    : r.status === 404 && r.data.message === 'Campaign not found';
  console.log(`B1 Trends: ${passed ? 'PASS' : 'CHECK_REQUIRED'} (${owner ? 'Promo owner' : 'second account'}, HTTP ${r.status})`);
})().catch(() => console.log('B1 Trends: INCOMPLETE — no response contents printed.'));

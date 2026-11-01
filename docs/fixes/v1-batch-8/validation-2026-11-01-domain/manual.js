// User-run, same-origin authorization checks. No imports, mappings, deletes or settings saves.
(async () => {
  const m = {"draftId":"519ee09b-b509-4162-b716-3d8a5395f2dc","clientId":"e3ec20ad-89ea-450d-8caf-8c0ab7abd220","shopifyCampaignId":"36631f9f-5f32-4ae6-8d20-d8430abb364c","ownerSha256":"d4b19e59f3d130850f83827b53ad753bb3875b4df8c7319cf33de0e77c8fa94f","shopDomain":"linkedin-revenue.myshopify.com","previousShopifyConnectionId":"62cf9267-2348-46f2-aae0-ddf7ec021081"};
  const checks = [], key = 'mimo-domain-callback-result-v1';
  let active = null, panel, status, buttons = [], channel;
  const requireCheck = (ok, code) => { if (!ok) throw Error(code); };
  const actor = window.Clerk?.user?.id;
  const assertActor = () => requireCheck(window.Clerk?.user?.id === actor, 'ACCOUNT_CHANGED');
  const report = (result, code) => {
    const value = { domainAuthorization: result, at: new Date().toISOString(), draftId: m?.draftId, shopifyCampaignId: m?.shopifyCampaignId, checks: checks.slice(), ...(code ? { code } : {}) };
    if (m) sessionStorage.setItem(key, JSON.stringify(value));
    console.log(JSON.stringify(value, null, 2));
    return value;
  };
  const stop = code => {
    if (active) { clearTimeout(active.timer); try { active.popup.close(); } catch {} active = null; }
    buttons.forEach(button => { button.disabled = true; });
    if (status) status.textContent = 'Check stopped. Copy the CHECK_REQUIRED result from Console.';
    report('CHECK_REQUIRED', code);
  };
  const request = async (url, body) => {
    assertActor();
    const response = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000), ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    requireCheck(response.ok, 'REQUEST_FAILED');
    const data = await response.json();
    assertActor();
    return data;
  };
  const verifyCampaign = async (id, name, state) => {
    const c = await request(`/api/campaigns/${id}`);
    requireCheck(c.id === id && c.ownerId === actor && c.clientId === m.clientId && c.name === name && c.status === state, 'CAMPAIGN_CHANGED');
  };
  try {
    requireCheck(m && location.origin === 'https://app.mimosaas.app', 'WRONG_ORIGIN');
    requireCheck(typeof actor === 'string', 'SIGN_IN_REQUIRED');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(actor));
    requireCheck(Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('') === m.ownerSha256, 'USE_SECOND_ACCOUNT');
    requireCheck(!window.__mimoDomainCheck, 'CHECK_ALREADY_OPEN');
    const previous = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (previous?.draftId === m.draftId && previous.domainAuthorization === 'PASS_NEW_DOMAIN_CALLBACKS') { console.log(JSON.stringify(previous, null, 2)); return; }
    await verifyCampaign(m.draftId, 'Domain Connection Check', 'draft');
    await verifyCampaign(m.shopifyCampaignId, 'Batch 1 Provider Check', 'active');
    const shop = await request(`/api/shopify/${m.shopifyCampaignId}/status`);
    requireCheck(shop.connected === true && shop.authType === 'oauth' && shop.shopDomain === m.shopDomain, 'SHOPIFY_STORE_CHANGED');
    const providers = [
      { id: 'hubspot', label: '1. Connect HubSpot', campaignId: m.draftId, host: 'app.hubspot.com' },
      { id: 'salesforce', label: '2. Connect Salesforce', campaignId: m.draftId, host: 'login.salesforce.com' },
      { id: 'shopify', label: '3. Reconnect the same Shopify test store', campaignId: m.shopifyCampaignId, host: m.shopDomain },
    ];
    panel = document.createElement('div');
    Object.assign(panel.style, { position: 'fixed', zIndex: '2147483647', top: '20px', right: '20px', width: '360px', padding: '20px', border: '2px solid #c66218', borderRadius: '12px', background: '#fff8f0', color: '#26211e', font: '16px Arial', boxShadow: '0 8px 30px #0003' });
    const heading = document.createElement('h3'); heading.textContent = 'New-domain connection check'; panel.appendChild(heading);
    const note = document.createElement('p'); note.textContent = 'Use the same test provider accounts. Complete each sign-in, then return here. This check does not import data.'; panel.appendChild(note);
    status = document.createElement('p'); status.textContent = 'Ready for HubSpot.'; panel.appendChild(status);
    const receive = async (data, source, broadcast = false) => {
      const current = active;
      if (!current || current.handling || !data || typeof data !== 'object') return;
      if (broadcast ? !['shopify', 'salesforce'].includes(current.provider.id) : source !== current.popup) return;
      const provider = current.provider;
      if (![`${provider.id}_auth_success`, `${provider.id}_auth_error`].includes(data.type)) return;
      current.handling = true;
      try {
        assertActor();
        requireCheck(data.type === `${provider.id}_auth_success`, 'PROVIDER_AUTHORIZATION_FAILED');
        if (provider.id === 'shopify') requireCheck(data.shopDomain === m.shopDomain && typeof data.connectionId === 'string' && data.connectionId !== m.previousShopifyConnectionId, 'SHOPIFY_RESULT_MISMATCH');
        await verifyCampaign(provider.campaignId, provider.id === 'shopify' ? 'Batch 1 Provider Check' : 'Domain Connection Check', provider.id === 'shopify' ? 'active' : 'draft');
        const saved = await request(`/api/${provider.id}/${provider.campaignId}/status`);
        requireCheck(saved.connected === true, 'CONNECTION_NOT_SAVED');
        if (provider.id === 'shopify') requireCheck(saved.shopDomain === m.shopDomain && saved.authType === 'oauth', 'SHOPIFY_STORE_CHANGED');
        clearTimeout(current.timer);
        try { current.popup.close(); } catch {}
        active = null;
        checks.push({ provider: provider.id, callbackOrigin: location.origin, passed: true, ...(provider.id === 'shopify' ? { connectionId: data.connectionId } : {}) });
        if (checks.length === 3) {
          status.textContent = 'All three passed. Copy PASS_NEW_DOMAIN_CALLBACKS from Console. Keep this page open.';
          report('PASS_NEW_DOMAIN_CALLBACKS');
        } else {
          status.textContent = `${provider.id} passed. Continue with ${providers[checks.length].id}.`;
          buttons[checks.length].disabled = false;
          report('IN_PROGRESS');
        }
      } catch (error) { stop(['ACCOUNT_CHANGED', 'PROVIDER_AUTHORIZATION_FAILED', 'SHOPIFY_RESULT_MISMATCH', 'CAMPAIGN_CHANGED', 'CONNECTION_NOT_SAVED', 'SHOPIFY_STORE_CHANGED'].includes(error.message) ? error.message : 'REQUEST_INCOMPLETE'); }
    };
    const onMessage = event => { if (event.origin === location.origin) void receive(event.data, event.source); };
    window.addEventListener('message', onMessage);
    channel = new BroadcastChannel('metricmind_oauth');
    channel.onmessage = event => { void receive(event.data, null, true); };
    for (const [index, provider] of providers.entries()) {
      const button = document.createElement('button');
      button.textContent = provider.label; button.disabled = index !== 0;
      Object.assign(button.style, { display: 'block', width: '100%', marginTop: '12px', padding: '12px', cursor: 'pointer' });
      button.onclick = async () => {
        if (active || checks.length !== index) return;
        try {
          assertActor();
          const popup = window.open('about:blank', `domain-check-${provider.id}`, 'width=650,height=760,scrollbars=yes,resizable=yes');
          requireCheck(popup, 'POPUP_BLOCKED');
          active = { provider, popup, handling: false, timer: setTimeout(() => stop('AUTHORIZATION_TIMED_OUT'), 300000) };
          buttons.forEach(b => { b.disabled = true; });
          status.textContent = `Complete ${provider.id} sign-in in the opened window.`;
          await verifyCampaign(provider.campaignId, provider.id === 'shopify' ? 'Batch 1 Provider Check' : 'Domain Connection Check', provider.id === 'shopify' ? 'active' : 'draft');
          if (provider.id === 'shopify') {
            const currentShop = await request(`/api/shopify/${m.shopifyCampaignId}/status`);
            requireCheck(currentShop.connected === true && currentShop.shopDomain === m.shopDomain && currentShop.authType === 'oauth', 'SHOPIFY_STORE_CHANGED');
          }
          const data = await request(`/api/auth/${provider.id}/connect`, { campaignId: provider.campaignId, ...(provider.id === 'shopify' ? { shopDomain: m.shopDomain } : {}) });
          const url = new URL(data.authUrl);
          requireCheck(url.protocol === 'https:' && url.hostname === provider.host && !url.username && !url.password && !url.port, 'UNEXPECTED_PROVIDER_URL');
          requireCheck(url.searchParams.get('redirect_uri') === `${location.origin}/api/auth/${provider.id}/callback`, 'WRONG_CALLBACK_DOMAIN');
          assertActor();
          requireCheck(active?.popup === popup, 'CHECK_STOPPED');
          popup.location.href = url.href;
        } catch (error) { stop(['ACCOUNT_CHANGED', 'CAMPAIGN_CHANGED', 'SHOPIFY_STORE_CHANGED', 'POPUP_BLOCKED', 'UNEXPECTED_PROVIDER_URL', 'WRONG_CALLBACK_DOMAIN'].includes(error.message) ? error.message : 'REQUEST_INCOMPLETE'); }
      };
      buttons.push(button); panel.appendChild(button);
    }
    document.body.appendChild(panel);
    window.__mimoDomainCheck = { report: () => report(checks.length === 3 ? 'PASS_NEW_DOMAIN_CALLBACKS' : 'IN_PROGRESS'), remove: () => { if (active) return; panel.remove(); window.removeEventListener('message', onMessage); channel.close(); delete window.__mimoDomainCheck; } };
    return window.__mimoDomainCheck;
  } catch (error) {
    report('CHECK_REQUIRED', ['WRONG_ORIGIN', 'SIGN_IN_REQUIRED', 'USE_SECOND_ACCOUNT', 'CHECK_ALREADY_OPEN', 'CAMPAIGN_CHANGED', 'SHOPIFY_STORE_CHANGED'].includes(error.message) ? error.message : 'REQUEST_INCOMPLETE');
  }
})();

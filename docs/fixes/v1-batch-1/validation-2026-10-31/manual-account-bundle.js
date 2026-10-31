// Run the SAME file in: second account, Promo owner, then second account.
// Creates seven marked, detached test rows and one paused browser-only report.
// No provider, financial import, real report generation, email or campaign edit.
// Database cleanup is a separate exact-ID procedure after independent verification.
(async () => {
  const key = 'mimosaas_batch1_account_acceptance_20261031';
  const reportKey = 'marketpulse_reports';
  const owner = 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U';
  const secondHash = '1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096';
  const promo = 'b74f98af-ede9-47af-9b19-0720ebb4d2c0';
  const testCampaign = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
  const fixtureSchedule = { frequency: 'daily', day: 'monday', time: '09:00', recipients: [] };
  const hasFixtureSchedule = value => value && Object.keys(value).length === 4 && value.frequency === 'daily' && value.day === 'monday' && value.time === '09:00' && Array.isArray(value.recipients) && value.recipients.length === 0;
  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
  const requireCheck = (condition, code) => { if (!condition) throw Error(code); };
  requireCheck(location.origin === 'https://marketforensics.onrender.com', 'WRONG_ORIGIN');
  const actor = window.Clerk?.user?.id;
  requireCheck(typeof actor === 'string', 'SIGN_IN_REQUIRED');
  const secondary = actor !== owner && await digest(actor) === secondHash;
  requireCheck(secondary || actor === owner, 'WRONG_ACCOUNT');
  let state = JSON.parse(localStorage.getItem(key) || 'null');
  const checks = [];
  const save = () => localStorage.setItem(key, JSON.stringify(state));
  const check = (name, value) => { checks.push({ check: name, passed: !!value }); requireCheck(value, name); };
  const request = async (url, method = 'GET', body) => {
    const r = await fetch(url, { method, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(20000), ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  const collectionPaths = { metric: '/api/metrics', performance: '/api/performance', integration: '/api/integrations', model: '/api/attribution/models', journey: '/api/attribution/journeys' };
  const list = async name => {
    const r = await request(collectionPaths[name]);
    check(`${name} owner-scoped collection`, r.status === 200 && Array.isArray(r.data) && r.data.every(x => x.ownerId === actor));
    if (name === 'integration') check('integration credentials redacted', r.data.every(x => x.credentials === null));
    return r.data;
  };
  const summary = result => console.log(JSON.stringify({ batch1AccountBundle: result, account: secondary ? 'Second account' : 'Promo owner',
    phase: state?.phase, run: state?.run, tag: state?.tag, date: state?.date, ids: state?.ids, pending: state?.pending || null, checks }, null, 2));
  try {
    if (!state) {
      requireCheck(secondary, 'START_WITH_SECOND_ACCOUNT');
      const parent = await request(`/api/campaigns/${testCampaign}`);
      check('expected disposable campaign owner', parent.status === 200 && parent.data.id === testCampaign && parent.data.ownerId === actor && parent.data.name === 'Batch 1 Provider Check');
      const run = crypto.randomUUID();
      state = { version: 1, run, tag: `B1_ACCESS_${run}`, phase: 'creating', date: new Date().toISOString().slice(0, 10), ids: {}, baseline: {}, pending: null };
      save();
      for (const name of Object.keys(collectionPaths)) state.baseline[name] = (await list(name)).map(x => x.id);
      save();
      const create = async (name, url, body, validate) => {
        state.pending = name; save(); // A lost response must not trigger an automatic repeat POST.
        const r = await request(url, 'POST', body);
        check(`${name} create`, r.status === 200 && uuid(r.data?.id));
        state.ids[name] = r.data.id; state.pending = null; save();
        check(`${name} saved scope`, validate(r.data));
      };
      await create('metric', collectionPaths.metric, { name: state.tag, value: '0', change: '0', icon: 'Activity', ownerId: owner }, x => x.ownerId === actor && x.name === state.tag);
      await create('performance', collectionPaths.performance, { date: state.date, impressions: 0, clicks: 0, conversions: 0, ownerId: owner }, x => x.ownerId === actor && x.date === state.date && x.impressions === 0 && x.clicks === 0 && x.conversions === 0);
      await create('integration', collectionPaths.integration, { platform: 'batch1_access_check', name: state.tag, credentials: JSON.stringify({ auditMarker: state.tag }), connected: true, ownerId: owner }, x => x.ownerId === actor && x.name === state.tag && x.credentials === null && x.connected === false);
      await create('model', collectionPaths.model, { name: state.tag, type: 'first_touch', description: state.tag, isDefault: false, isActive: false, ownerId: owner }, x => x.ownerId === actor && !x.isDefault && !x.isActive);
      await create('journey', collectionPaths.journey, { customerId: state.tag, sessionId: state.tag, journeyStart: `${state.date}T00:00:00.000Z`, conversionValue: '0.00', status: 'abandoned', ownerId: owner }, x => x.ownerId === actor && x.customerId === state.tag && Number(x.conversionValue) === 0);
      await create('touchpoint', '/api/attribution/touchpoints', { journeyId: state.ids.journey, channel: 'direct', touchpointType: 'view', position: 1, timestamp: `${state.date}T00:00:00.000Z`, metadata: state.tag }, x => x.journeyId === state.ids.journey && x.campaignId === null && x.metadata === state.tag);
      const calc = await request('/api/attribution/calculate', 'POST', { journeyId: state.ids.journey, modelId: state.ids.model });
      check('detached zero-value attribution', calc.status === 200 && Array.isArray(calc.data) && calc.data.length === 1 && uuid(calc.data[0].id)
        && calc.data[0].journeyId === state.ids.journey && calc.data[0].attributionModelId === state.ids.model && calc.data[0].touchpointId === state.ids.touchpoint
        && calc.data[0].campaignId === null && Number(calc.data[0].attributedValue) === 0 && Number(calc.data[0].attributionCredit) === 1);
      state.ids.result = calc.data[0].id; save();
      const modelEdit = await request(`/api/attribution/models/${state.ids.model}`, 'PATCH', { description: `${state.tag}:edited`, ownerId: owner, id: run });
      check('owned model edit preserves identity', modelEdit.status === 200 && modelEdit.data.id === state.ids.model && modelEdit.data.ownerId === actor && modelEdit.data.description === `${state.tag}:edited`);
      const journeyEdit = await request(`/api/attribution/journeys/${state.ids.journey}`, 'PATCH', { conversionType: 'custom', ownerId: owner, id: run });
      check('owned journey edit preserves identity', journeyEdit.status === 200 && journeyEdit.data.id === state.ids.journey && journeyEdit.data.ownerId === actor && journeyEdit.data.conversionType === 'custom');
      for (const name of Object.keys(collectionPaths)) check(`${name} positive persisted read`, (await list(name)).some(x => x.id === state.ids[name]));
      const trends = await request(`/api/campaigns/${promo}/google-trends`);
      check('foreign Trends denied', trends.status === 404 && trends.data.message === 'Campaign not found');
      const reports = JSON.parse(localStorage.getItem(reportKey) || '[]');
      requireCheck(Array.isArray(reports), 'REPORT_CACHE_FORMAT');
      state.reportId = `b1_access_${run}`;
      requireCheck(!reports.some(x => x.id === state.reportId), 'REPORT_FIXTURE_COLLISION');
      localStorage.setItem(reportKey, JSON.stringify([...reports, { id: state.reportId, name: state.tag, type: 'performance-summary', status: 'Paused', campaignId: testCampaign, campaignName: 'Batch 1 Provider Check', generatedAt: new Date().toISOString(), format: 'PDF', schedule: fixtureSchedule }]));
      state.phase = 'owner_ready'; save(); summary('PASS_OWNER'); return;
    }
    requireCheck(state.version === 1 && uuid(state.run) && state.tag === `B1_ACCESS_${state.run}`, 'MANIFEST_INVALID');
    requireCheck(['metric','performance','integration','model','journey','touchpoint','result'].every(x => uuid(state.ids?.[x])), 'MANIFEST_INCOMPLETE_DO_NOT_RETRY');
    requireCheck(!state.pending && state.phase !== 'creating', 'PARTIAL_RUN_DO_NOT_RETRY');
    if (secondary && state.phase === 'owner_ready') {
      // Correct only the existing browser fixture; no fetch, database write or schedule activation.
      const reports = JSON.parse(localStorage.getItem(reportKey) || '[]');
      requireCheck(Array.isArray(reports), 'REPORT_CACHE_FORMAT');
      const fixture = reports.filter(x => x.id === state.reportId);
      check('exact paused browser fixture', state.reportId === `b1_access_${state.run}` && fixture.length === 1 && fixture[0].name === state.tag && fixture[0].campaignId === testCampaign && fixture[0].status === 'Paused' && !fixture[0].backendReportId && !fixture[0].downloadUrl && (fixture[0].schedule == null || hasFixtureSchedule(fixture[0].schedule)));
      if (fixture[0].schedule == null) localStorage.setItem(reportKey, JSON.stringify(reports.map(x => x.id === state.reportId ? { ...x, schedule: fixtureSchedule } : x)));
      window.dispatchEvent(new Event('reportAdded'));
      summary('PASS_REPORT_READY'); return;
    }
    if (!secondary && state.phase === 'owner_ready') {
      for (const name of Object.keys(collectionPaths)) check(`${name} actual foreign row hidden`, !(await list(name)).some(x => x.id === state.ids[name]));
      const negatives = [
        ['journey read', `/api/attribution/journeys/${state.ids.journey}`, 'GET'],
        ['touchpoints read', `/api/attribution/touchpoints?journeyId=${state.ids.journey}`, 'GET'],
        ['model edit', `/api/attribution/models/${state.ids.model}`, 'PATCH', { description: `${state.tag}:foreign` }],
        ['journey edit', `/api/attribution/journeys/${state.ids.journey}`, 'PATCH', { conversionType: 'foreign' }],
        ['touchpoint insert', '/api/attribution/touchpoints', 'POST', { journeyId: state.ids.journey, channel: 'direct', touchpointType: 'view', position: 2, timestamp: `${state.date}T00:00:00.000Z`, metadata: state.tag }],
        ['attribution calculate', '/api/attribution/calculate', 'POST', { journeyId: state.ids.journey, modelId: state.ids.model }],
        ['model deletion', `/api/attribution/models/${state.ids.model}`, 'DELETE'],
      ];
      for (const [name, url, method, body] of negatives) {
        const r = await request(url, method, body);
        check(`foreign ${name} denied`, r.status === 404);
      }
      const campaign = await request(`/api/campaigns/${promo}`);
      check('Promo Trends preflight', campaign.status === 200 && campaign.data.id === promo && campaign.data.ownerId === actor);
      requireCheck(campaign.data.trendKeywords == null || Array.isArray(campaign.data.trendKeywords) && campaign.data.trendKeywords.length === 0, 'TRENDS_CONFIGURED_NO_PROVIDER_REQUEST_SENT');
      const trends = await request(`/api/campaigns/${promo}/google-trends`);
      check('owned Trends reaches no-keywords branch', trends.status === 400 && trends.data.message === 'No trend keywords configured for this campaign');
      for (const [name, url, limit] of [
        ['OAuth', '/api/auth/hubspot/connect', 10],
        ['LinkedIn', '/api/linkedin/campaigns', 30],
        ['Import', `/api/campaigns/${state.run}/spend/csv/preview`, 5],
      ]) {
        for (const isTestMode of [true, false]) {
          const r = await request(url, 'POST', { isTestMode });
          check(`${name} invalid input rejected`, r.status === (name === 'Import' ? 404 : 400));
          const remaining = r.headers.get('ratelimit-remaining');
          check(`${name} ${isTestMode ? 'test flag' : 'ordinary'} still counted`, Number(r.headers.get('ratelimit-limit')) === limit && remaining !== null && /^\d+$/.test(remaining) && Number(remaining) < limit);
          requireCheck(isTestMode === false || Number(remaining) > 0, 'QUOTA_LOW_STOP_WITHOUT_SATURATING');
        }
      }
      state.phase = 'foreign_ready'; save(); summary('PASS_FOREIGN'); return;
    }
    if (secondary && state.phase === 'foreign_ready') {
      for (const name of Object.keys(collectionPaths)) {
        const rows = await list(name), row = rows.find(x => x.id === state.ids[name]);
        check(`${name} persists after account switch`, !!row);
        if (name === 'model') check('foreign edit did not change model', row.description === `${state.tag}:edited` && !row.isDefault && !row.isActive);
        if (name === 'journey') check('foreign edit did not change journey', row.customerId === state.tag && row.conversionType === 'custom' && Number(row.conversionValue) === 0);
      }
      const touchpoints = await request(`/api/attribution/touchpoints?journeyId=${state.ids.journey}`);
      check('foreign insert did not add touchpoint', touchpoints.status === 200 && Array.isArray(touchpoints.data) && touchpoints.data.length === 1 && touchpoints.data[0].id === state.ids.touchpoint && touchpoints.data[0].campaignId === null);
      const reports = JSON.parse(localStorage.getItem(reportKey) || '[]');
      requireCheck(Array.isArray(reports), 'REPORT_CACHE_FORMAT');
      const fixture = reports.filter(x => x.id === state.reportId);
      check('only exact browser fixture removed', state.reportId === `b1_access_${state.run}` && fixture.length === 1 && fixture[0].name === state.tag && fixture[0].campaignId === testCampaign && fixture[0].status === 'Paused' && (fixture[0].schedule == null || hasFixtureSchedule(fixture[0].schedule)) && !fixture[0].backendReportId && !fixture[0].downloadUrl);
      localStorage.setItem(reportKey, JSON.stringify(reports.filter(x => x.id !== state.reportId)));
      state.phase = 'awaiting_database_cleanup'; save(); summary('PASS_RECHECK'); return;
    }
    summary('ALREADY_RECORDED_OR_OTHER_ACCOUNT_REQUIRED');
  } catch (error) {
    summary('CHECK_REQUIRED');
    console.log('Stopped safely: ' + (/^[A-Za-z0-9 _:-]+$/.test(error?.message || '') ? error.message : 'REQUEST_OR_STORAGE_FAILED'));
  }
})().catch(() => console.log('B1 account check: INCOMPLETE. No credentials or response contents printed.'));

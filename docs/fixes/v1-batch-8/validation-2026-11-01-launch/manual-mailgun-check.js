// Paste in the signed-in app Console. No email is sent until the labeled button is clicked.
// Exact existing Promo Overview report only; one request, no automatic retry or schedule edits.
(async () => {
  const actor = 'user_3LTouyBkb8CfKyfoAk2L4nw7QKN';
  const campaignId = 'b74f98af-ede9-47af-9b19-0720ebb4d2c0';
  const reportId = '670f24df-9886-4332-b1c6-34c16b955331';
  const marker = 'mimo-mailgun-restored-2026-11-01';
  const base = '/api/platforms/google_analytics/reports';
  const check = (value, code) => { if (!value) throw new Error(code); };
  const identity = () => {
    check(location.origin === 'https://app.mimosaas.app', 'OPEN_PRODUCTION_APP');
    check(window.Clerk?.user?.id === actor && window.Clerk?.session, 'SIGN_IN_AS_PROMO_OWNER');
  };
  const request = async (url, method = 'GET') => {
    identity();
    const token = await window.Clerk.session.getToken();
    identity(); check(token, 'SIGN_IN_REQUIRED');
    const response = await fetch(url, { method, credentials:'same-origin', redirect:'error', cache:'no-store', headers:{ Authorization:'Bearer ' + token, Accept:'application/json' } });
    const data = await response.json();
    return { response, data };
  };
  const readReport = async () => {
    const { response, data } = await request(base + '?campaignId=' + campaignId);
    check(response.ok && Array.isArray(data), 'REPORT_READ_FAILED');
    const matches = data.filter(row => row.id === reportId);
    check(matches.length === 1, 'EXACT_REPORT_REQUIRED');
    const row = matches[0];
    check(row.campaignId === campaignId && row.platformType === 'google_analytics' && row.reportType === 'overview' && row.status === 'active' && row.scheduleEnabled === true, 'REPORT_SCOPE_CHANGED');
    check(Array.isArray(row.scheduleRecipients) && row.scheduleRecipients.length === 1 && typeof row.scheduleRecipients[0] === 'string' && row.scheduleRecipients[0].trim(), 'ONE_SAVED_RECIPIENT_REQUIRED');
    return row;
  };
  const fingerprint = row => JSON.stringify([row.id,row.campaignId,row.platformType,row.reportType,row.name,row.configuration,row.scheduleRecipients,row.scheduleEnabled,row.status]);
  const report = (state, extra = {}) => console.log(JSON.stringify({ mailgunRecovery:state, at:new Date().toISOString(), reportId, campaignId, ...extra }, null, 2));
  try {
    identity();
    check(!document.getElementById(marker), 'CHECK_PANEL_ALREADY_OPEN');
    check(!sessionStorage.getItem(marker), 'ALREADY_REQUESTED_CHECK_AUDIT_BEFORE_RETRY');
    const saved = await readReport();
    check(!document.getElementById(marker), 'CHECK_PANEL_ALREADY_OPEN');
    const panel = document.createElement('section'); panel.id = marker;
    panel.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;max-width:420px;padding:20px;background:white;color:#222;border:2px solid #ff7800;border-radius:12px;box-shadow:0 4px 24px #0004;font:16px/1.5 sans-serif';
    const text = document.createElement('p');
    text.textContent = 'Mailgun recovery check: send one copy of Promo’s saved Overview report to ' + saved.scheduleRecipients[0] + '. The PDF and delivery audit will be generated; the saved schedule stays unchanged.';
    const button = document.createElement('button'); button.textContent = 'Send one test report';
    button.style.cssText = 'padding:10px 16px;background:#ff7800;color:white;border:0;border-radius:8px;cursor:pointer;font:inherit';
    const close = document.createElement('button'); close.textContent = 'Close'; close.style.marginLeft = '12px'; close.onclick = () => panel.remove();
    let started = false;
    button.onclick = async () => {
      if (started) return;
      started = true; button.disabled = true; close.disabled = true;
      try {
        identity(); check(!sessionStorage.getItem(marker), 'ALREADY_REQUESTED_CHECK_AUDIT_BEFORE_RETRY');
        const current = await readReport();
        check(fingerprint(current) === fingerprint(saved), 'REPORT_CHANGED_NO_EMAIL_SENT');
        identity(); sessionStorage.setItem(marker, new Date().toISOString());
        text.textContent = 'Sending one report and checking delivery. Keep this tab open.';
        const { response, data } = await request(base + '/' + reportId + '/send-test', 'POST');
        const delivered = response.ok && data.success === true && data.deliveryStatus === 'delivered';
        const deliveryStatus = ['delivered','accepted','pending','failed'].includes(data.deliveryStatus) ? data.deliveryStatus : 'unconfirmed';
        text.textContent = delivered ? 'PASS_MAILGUN_DELIVERY — Mailgun confirmed delivery. The result is in Console.' : 'CHECK_REQUIRED — do not send again. The saved audit must be checked first.';
        report(delivered ? 'PASS_MAILGUN_DELIVERY' : 'CHECK_REQUIRED', { httpStatus:response.status, deliveryStatus, recipientCount:1 });
      } catch {
        text.textContent = 'CHECK_REQUIRED — do not send again. The saved audit must be checked first.';
        report('CHECK_REQUIRED', { code:'REQUEST_INCOMPLETE', attempted:Boolean(sessionStorage.getItem(marker)) });
      } finally { close.disabled = false; }
    };
    panel.append(text,button,close); document.body.appendChild(panel);
  } catch (error) {
    const known = ['OPEN_PRODUCTION_APP','SIGN_IN_AS_PROMO_OWNER','SIGN_IN_REQUIRED','CHECK_PANEL_ALREADY_OPEN','ALREADY_REQUESTED_CHECK_AUDIT_BEFORE_RETRY','REPORT_READ_FAILED','EXACT_REPORT_REQUIRED','REPORT_SCOPE_CHANGED','ONE_SAVED_RECIPIENT_REQUIRED'];
    report('CHECK_REQUIRED', { code:known.includes(error.message) ? error.message : 'PREPARATION_FAILED' });
  }
})();

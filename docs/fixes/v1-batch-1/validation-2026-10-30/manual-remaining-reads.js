// Run once in each signed-in account. GET only; prints status/counts, never response contents.
(async () => {
  const origin = "https://marketforensics.onrender.com";
  if (location.origin !== origin) throw new Error("Open the app's onrender.com page first.");
  const actor = window.Clerk?.user?.id;
  if (!actor) throw new Error("Sign in and wait for the app to load first.");
  const campaignId = "b74f98af-ede9-47af-9b19-0720ebb4d2c0";
  const owner = actor === "user_3K7q6o5pF0aykjIQSHy5O7mVi2U";
  const checks = [];
  const read = async (route) => {
    const r = await fetch(route, { method: "GET", credentials: "same-origin", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    return { status: r.status, data: await r.json() };
  };
  for (const name of ["metrics", "performance", "integrations", "attribution/models", "attribution/journeys"]) {
    const { status, data } = await read("/api/" + name);
    const passed = status === 200 && Array.isArray(data) && data.every(row => row.ownerId === actor && (name !== "integrations" || row.credentials === null));
    checks.push({ check: name, status, rows: Array.isArray(data) ? data.length : null, passed });
  }
  for (const suffix of ["linkedin-campaigns", "linkedin-campaign-revenue", "attribution"]) {
    const { status, data } = await read(`/api/campaigns/${campaignId}/${suffix}`);
    checks.push({ check: suffix, status, passed: owner ? status === 200 : status === 404 && data.message === "Campaign not found" });
  }
  // GA4 uses the same campaign-access guard and does not dispatch provider schema reads.
  const fields = await read(`/api/platforms/google_analytics/fields?campaignId=${campaignId}`);
  checks.push({ check: "campaign field catalog", status: fields.status, passed: owner ? fields.status === 200 : fields.status === 404 && fields.data.message === "Campaign not found" });
  const channel = await read("/api/attribution/channel-performance");
  checks.push({ check: "attribution channel read", status: channel.status, passed: channel.status === 200 && Array.isArray(channel.data) });
  // A nonexistent parent is intentionally used; no data is changed.
  for (const suffix of ["journeys/batch1-read-check-nonexistent", "touchpoints?journeyId=batch1-read-check-nonexistent"]) {
    const { status } = await read("/api/attribution/" + suffix);
    checks.push({ check: suffix, status, passed: status === 404 });
  }
  console.log(JSON.stringify({ batch1ReadCheck: checks.every(c => c.passed) ? "PASS" : "CHECK_REQUIRED", account: owner ? "Promo owner" : "Second account", checks }, null, 2));
})().catch(() => console.log(JSON.stringify({ batch1ReadCheck: "INCOMPLETE", instruction: "Keep the page open and report INCOMPLETE; do not copy credentials or response bodies." })));

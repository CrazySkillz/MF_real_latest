#!/usr/bin/env node
// Simple test script to exercise campaign creation + manual LinkedIn-scoped revenue
// Usage: 1) Start the dev server locally (see README steps). 2) Run: `node scripts/test-linkedin-shopify-flow.js`

const base = process.env.BASE_URL || 'http://localhost:5000';
const headers = { 'Content-Type': 'application/json' };

async function req(path, opts = {}) {
    const url = base + path;
    const r = await fetch(url, opts);
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { };
    return { status: r.status, ok: r.ok, text, json };
}

(async () => {
    try {
        console.log('Creating campaign...');
        const create = await req('/api/campaigns', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Test Campaign (script)', currency: 'USD' }),
        });
        console.log('create.status=', create.status);
        console.log('create.body=', create.text);
        const created = create.json || {};
        const campaignId = created?.id || (created?.campaign?.id) || (created?.id === undefined ? null : created?.id);
        if (!campaignId && created?.id === undefined && created?.message) {
            // Some deployments return the campaign object differently; try parsing text for id
        }
        const id = campaignId || (created && created.id) || (created && created.campaign && created.campaign.id);
        if (!id) {
            console.error('Failed to determine campaign id from response. Create response:', create.text);
            process.exit(1);
        }
        console.log('Campaign created:', id);

        // Add manual LinkedIn-scoped revenue (this simulates what Shopify save-mappings would materialize)
        console.log('Posting LinkedIn-scoped manual revenue (amount=123.45)...');
        const rev = await req(`/api/campaigns/${encodeURIComponent(id)}/revenue/process/manual`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ amount: 123.45, platformContext: 'linkedin', valueSource: 'revenue', currency: 'USD' }),
        });
        console.log('revenue.status=', rev.status);
        console.log('revenue.body=', rev.text);

        // Fetch revenue-to-date for LinkedIn
        console.log('Fetching revenue-to-date (linkedin)...');
        const totals = await req(`/api/campaigns/${encodeURIComponent(id)}/revenue-to-date?platformContext=linkedin`);
        console.log('totals.status=', totals.status);
        console.log('totals.body=', totals.text);

        console.log('\nDone. If totals show the expected 123.45 as totalRevenue, the flow matched.');
    } catch (e) {
        console.error('Script error:', e);
        process.exit(2);
    }
})();

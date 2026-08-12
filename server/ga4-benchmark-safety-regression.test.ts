import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf-8');

describe('GA4 Benchmark safety regression guard', () => {
  it('keeps the shared PATCH Benchmark alias schema-validated and scope-immutable', () => {
    const routes = read('server', 'routes-oauth.ts');
    const routeStart = routes.indexOf('/api/benchmarks/:benchmarkId');
    const routeEnd = routes.indexOf('/api/benchmarks/:benchmarkId', routeStart + 1);
    const route = routes.slice(routeStart, routeEnd);
    const fallbackStart = route.indexOf('if (!existingBenchmark) {');
    const fallbackEnd = route.indexOf('const ok = await ensureCampaignAccess', fallbackStart);
    const fallback = route.slice(fallbackStart, fallbackEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(fallbackStart).toBeGreaterThan(-1);
    expect(fallbackEnd).toBeGreaterThan(fallbackStart);
    expect(fallback).toContain('insertBenchmarkSchema.partial().parse');
    expect(fallback).toContain('campaignId: (existing as any).campaignId');
    expect(fallback).toContain('platformType: (existing as any).platformType');
    expect(fallback).toMatch(/delete \w+\.campaignId/);
    expect(fallback).toMatch(/delete \w+\.platformType/);
    expect(fallback).not.toContain('storage.updateBenchmark(benchmarkId, updates)');
  });

  it('fails closed for ownerless campaigns across the GA4 Benchmark lifecycle', () => {
    const jobs = read('server', 'ga4-kpi-benchmark-jobs.ts');
    const notifications = read('server', 'benchmark-notifications.ts');
    const emailAlerts = read('server', 'services', 'alert-monitoring.ts');

    const jobLoopStart = jobs.indexOf('for (const campaign of campaigns) {');
    const jobWorkStart = jobs.indexOf('    try {', jobLoopStart);
    const jobCampaignGate = jobs.slice(jobLoopStart, jobWorkStart);
    expect(jobLoopStart).toBeGreaterThan(-1);
    expect(jobWorkStart).toBeGreaterThan(jobLoopStart);
    expect(jobCampaignGate).toContain('ownerId');
    expect(jobCampaignGate).toMatch(/if \(!\w*[Oo]wner\w*\) \{[\s\S]*continue;/);

    const notificationCampaignStart = notifications.indexOf('const campaign = await storage.getCampaign(campaignId)');
    const notificationWorkStart = notifications.indexOf('const actionUrl = buildBenchmarkActionUrl', notificationCampaignStart);
    const notificationCampaignGate = notifications.slice(notificationCampaignStart, notificationWorkStart);
    expect(notificationCampaignStart).toBeGreaterThan(-1);
    expect(notificationWorkStart).toBeGreaterThan(notificationCampaignStart);
    expect(notificationCampaignGate).toContain('ownerId');
    expect(notificationCampaignGate).toContain('if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");');
    expect(notificationCampaignGate).toMatch(/if \(!\w*[Oo]wner\w*\) \{[\s\S]*continue;/);

    const campaignLookupStart = emailAlerts.indexOf('private async getExistingCampaignName');
    const campaignLookupEnd = emailAlerts.indexOf('private async claimAlertEmailWindow', campaignLookupStart);
    const campaignLookup = emailAlerts.slice(campaignLookupStart, campaignLookupEnd);
    expect(campaignLookupStart).toBeGreaterThan(-1);
    expect(campaignLookupEnd).toBeGreaterThan(campaignLookupStart);
    expect(campaignLookup).toContain('ownerId: campaigns.ownerId');
    expect(campaignLookup).toMatch(/if \(!String\(campaign\?\.ownerId[\s\S]*\)\.trim\(\)\) return null;/);
  });

  it('never classifies ownerless campaigns as caller-owned in notification routes', () => {
    const routes = read('server', 'routes-oauth.ts');
    const routesStart = routes.indexOf('/api/notifications');
    const routesEnd = routes.indexOf('/api/notifications/:id', routesStart);
    const notificationRoutes = routes.slice(routesStart, routesEnd);

    expect(routesStart).toBeGreaterThan(-1);
    expect(routesEnd).toBeGreaterThan(routesStart);
    expect((notificationRoutes.match(/\.where\(eq\(\(campaigns as any\)\.ownerId, actorId\)\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(notificationRoutes).toContain('return ownerId === actorId;');
    expect(notificationRoutes).not.toContain('isNull((campaigns as any).ownerId)');
    expect(notificationRoutes).not.toMatch(/eq\(\(campaigns as any\)\.ownerId,\s*..\)/);
  });

  it('keeps the deployed Benchmark clearance browser and notification checks read-only', () => {
    const script = read('scripts', 'ga4-benchmark-beta-clearance-readonly.ts');
    const metricsPage = read('client', 'src', 'pages', 'ga4-metrics.tsx');

    expect(script).toContain('/ga4-metrics?tab=benchmarks&readOnly=1');
    expect(script).toContain('/api/notifications?readOnly=1');
    expect(metricsPage).toMatch(/const insightsValidationReadOnly = new URLSearchParams\(search\)\.get\(.readOnly.\) === .1.;/);
    expect(metricsPage).not.toMatch(/const insightsValidationReadOnly = activeTab === .insights. &&/);
  });
});

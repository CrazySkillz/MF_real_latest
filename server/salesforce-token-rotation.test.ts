import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('Salesforce OAuth refresh-token rotation', () => {
  it('serializes refreshes and persists the rotated refresh token', () => {
    const routes = readSource('server', 'routes-oauth.ts');
    const start = routes.indexOf('const salesforceTokenRefreshes = new Map<string, Promise<string>>();');
    const end = routes.indexOf('async function getSalesforceAccessTokenForCampaign', start);
    const refresh = routes.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(refresh).toContain('const inFlight = salesforceTokenRefreshes.get(connectionId);');
    expect(refresh).toContain('const latest: any = await storage.getSalesforceConnection(campaignId);');
    expect(refresh).toContain("refresh_token: String(latest.refreshToken)");
    expect(refresh).toContain('if (json.refresh_token) updateData.refreshToken = String(json.refresh_token);');
    expect(refresh).toContain('await storage.updateSalesforceConnection(connectionId, updateData);');
    expect(refresh).toContain('updated.refreshToken !== String(json.refresh_token)');
    expect(refresh).toContain('salesforceTokenRefreshes.set(connectionId, refreshPromise);');
    expect(refresh).toContain('salesforceTokenRefreshes.delete(connectionId);');
  });
});

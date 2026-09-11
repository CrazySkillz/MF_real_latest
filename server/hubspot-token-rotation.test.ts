import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(join(process.cwd(), 'server', 'routes-oauth.ts'), 'utf8');

describe('HubSpot OAuth refresh-token rotation', () => {
  it('refreshes expiring credentials through a serialized active-connection update', () => {
    const start = routes.indexOf('const hubspotTokenRefreshes = new Map<string, Promise<string>>();');
    const end = routes.indexOf('const salesforceTokenRefreshes = new Map<string, Promise<string>>();', start);
    const refresh = routes.slice(start, end);
    const accessStart = routes.indexOf('async function getHubspotAccessTokenForCampaign');
    const accessEnd = routes.indexOf('// Helper function to check if token needs proactive refresh', accessStart);
    const access = routes.slice(accessStart, accessEnd);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(refresh).toContain('const inFlight = hubspotTokenRefreshes.get(connectionId);');
    expect(refresh).toContain('const latest: any = await storage.getHubspotConnection(campaignId);');
    expect(refresh).toContain("throw new Error('HubSpot connection changed during token refresh')");
    expect(refresh).toContain('refresh_token: String(latest.refreshToken)');
    expect(refresh).toContain('if (tokens.refresh_token) updateData.refreshToken = String(tokens.refresh_token);');
    expect(refresh).toContain('const expiresInSeconds = Number(tokens.expires_in ?? tokens.expiresIn);');
    expect(refresh).toContain("throw new Error('HubSpot token refresh returned an invalid expiration')");
    expect(refresh).toContain('expiresAt: renewedExpiresAt');
    expect(refresh).toContain('const updated: any = await storage.updateHubspotConnection(connectionId, updateData);');
    expect(refresh).toContain('new Date(updated.expiresAt || 0).getTime() !== renewedExpiresAt.getTime()');
    expect(refresh).toContain('updated.refreshToken !== String(tokens.refresh_token)');
    expect(refresh).toContain('hubspotTokenRefreshes.set(connectionId, refreshPromise);');
    expect(refresh).toContain('hubspotTokenRefreshes.delete(connectionId);');
    expect(access).toContain("new Date(conn.expiresAt).getTime() < Date.now() + (5 * 60 * 1000)");
    expect(access).toContain('accessToken = await refreshHubspotToken(conn);');
  });
});

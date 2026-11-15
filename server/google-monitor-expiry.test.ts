import { afterEach, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ authorize: vi.fn(), request: vi.fn() }));
vi.mock('google-auth-library', () => ({ JWT: class { authorize = mocked.authorize; } }));
vi.mock('./utils/ga4-service-account', () => ({ clientAccountConfig: () => ({ email: 'issuer@fixture.test', key: 'fixture-key', projectId: 'fixture-project' }), clientAccountRequest: mocked.request }));
import { getGoogleAdsServiceAccountAccessToken, getGoogleAdsClientServiceAccountAccessToken } from './utils/google-ads-service-account';
import { getGoogleSheetsServiceAccountAccessToken, getGoogleSheetsClientServiceAccountAccessToken } from './utils/google-sheets-service-account';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); mocked.authorize.mockReset(); mocked.request.mockReset(); });
it.each([
  ['Ads', getGoogleAdsServiceAccountAccessToken], ['Sheets', getGoogleSheetsServiceAccountAccessToken],
] as const)('%s service email replaces an expired cached token and fails closed if renewal fails', async (name, get) => {
  let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.stubEnv(name === 'Ads' ? 'GOOGLE_ADS_SERVICE_ACCOUNT_JSON' : 'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON', JSON.stringify({ type: 'service_account', client_email: 'expiry@fixture.test', private_key: 'fixture-' + name }));
  mocked.authorize.mockImplementation(async () => ({ access_token: 'token-' + now, expiry_date: now + 3600000 }));
  const first = await get(); expect(await get()).toEqual(first); expect(mocked.authorize).toHaveBeenCalledTimes(1);
  now += 3600001; const renewed = await get(); expect(renewed.accessToken).not.toBe(first.accessToken); expect(renewed.expiresAt.getTime()).toBeGreaterThan(now); expect(mocked.authorize).toHaveBeenCalledTimes(2);
  now += 3600001; mocked.authorize.mockRejectedValue(new Error('provider unavailable')); await expect(get()).rejects.toThrow('provider unavailable');
});
it.each([
  ['Ads', getGoogleAdsClientServiceAccountAccessToken], ['Sheets', getGoogleSheetsClientServiceAccountAccessToken],
] as const)('%s client-specific service email renews its expired token without changing its binding', async (name, get) => {
  let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now);
  const binding: any = { id: 'binding', email: 'client@fixture-project.iam.gserviceaccount.com', googleUniqueId: name === 'Ads' ? '111' : '222' }, original = JSON.stringify(binding);
  mocked.request.mockImplementation(async () => new Response(JSON.stringify({ accessToken: 'token-' + now, expireTime: new Date(now + 3600000).toISOString() })));
  const first = await get(binding); expect(await get(binding)).toEqual(first); expect(mocked.request).toHaveBeenCalledTimes(1);
  now += 3600001; const renewed = await get(binding); expect(renewed.accessToken).not.toBe(first.accessToken); expect(renewed.expiresAt.getTime()).toBeGreaterThan(now); expect(mocked.request).toHaveBeenCalledTimes(2); expect(JSON.stringify(binding)).toBe(original);
  now += 3600001; mocked.request.mockResolvedValue(new Response('{}', { status: 401 })); await expect(get(binding)).rejects.toThrow('could not authorise');
});

import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function extract(file: string, name: string, route = false) {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = '';
  function visit(node: ts.Node) {
    if (!route && ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node.initializer!.getText(ast);
    if (route && ts.isCallExpression(node) && node.expression.getText(ast) === 'app.get'
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === name) found = node.arguments.at(-1)!.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); if (!found) throw new Error(`Missing callback: ${name}`); return found;
}
const bind = (source: string, deps: Record<string, any>) => new Function(...Object.keys(deps), ts.transpileModule(`return (${source});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps));
const handler = extract('server/routes-oauth.ts', '/api/campaigns/:id/ga4-campaign-values', true);
const response = () => ({ statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; }, setHeader() {} });

describe('campaign discovery API and onboarding consumers', () => {
  it('requires ownership before discovery and only opts in with explicit property and allowPartial', async () => {
    const ga4Service = { getCampaignValues: vi.fn(async () => ({ propertyId: '123', campaigns: [{ name: 'selected', users: 25 }], discoveryComplete: false })) };
    const access = vi.fn(async (_req: any, res: any) => { res.status(404).json({}); return false; });
    const run = bind(handler, { ga4Service, storage: { getCampaign: async () => ({}) }, ensureCampaignAccess: access, isYesopMockProperty: () => false, getGA4CampaignFilterValues: () => [], console });
    await run({ params: { id: 'fixture' }, query: {} }, response()); expect(ga4Service.getCampaignValues).not.toHaveBeenCalled();
    access.mockImplementation(async () => true);
    for (const [query, allowed] of [[{}, false], [{ allowPartial: '1' }, false], [{ propertyId: '123' }, false], [{ propertyId: '123', allowPartial: '1' }, true]] as const) {
      const res = response(); await run({ params: { id: 'fixture' }, query }, res);
      expect(ga4Service.getCampaignValues.mock.calls.at(-1)).toEqual(['fixture', expect.anything(), '30daysAgo', (query as any).propertyId, 50, allowed]);
      expect(res.body).toMatchObject({ success: true, campaigns: [{ name: 'selected', users: 25 }], discoveryComplete: false });
    }
    ga4Service.getCampaignValues.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
    const res = response(); await run({ params: { id: 'fixture' }, query: { propertyId: '123', allowPartial: '1' } }, res);
    expect(res.statusCode).toBe(500); expect(res.body.success).toBe(false);
  });
  it.each([false, true])('Create Campaign keeps exact returned names and clearly labels partial=%s', async partial => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ success: true })).mockResolvedValueOnce(Response.json({ success: true, campaigns: [{ name: 'exact_campaign', users: 25 }], ...(partial ? { discoveryComplete: false } : {}) }));
    const deps = { fetch, selectedGA4Property: '123', draftCampaignId: 'draft', wizardLookbackDays: 30, pendingGA4ConnectionId: 'pending', toast: vi.fn(), console,
      setIsGA4PropertyLoading: vi.fn(), setPendingGA4ConnectionId: vi.fn(), setConnectedPlatformsInDialog: vi.fn(), setWizardPlatformConnected: vi.fn(),
      setIsGA4CampaignLoading: vi.fn(), setGA4CampaignDiscoveryError: vi.fn(), setGA4CampaignValues: vi.fn(), setSelectedGA4CampaignValues: vi.fn(), setGa4ConfigSubStep: vi.fn() };
    await bind(extract('client/src/pages/campaigns.tsx', 'handleWizardPropertySelection'), deps)();
    expect(fetch.mock.calls[1][0]).toContain('propertyId=123&allowPartial=1');
    expect(deps.setGA4CampaignValues).toHaveBeenCalledWith([{ name: 'exact_campaign', users: 25 }]);
    expect(deps.setSelectedGA4CampaignValues).toHaveBeenCalledWith([]);
    expect(deps.setGA4CampaignDiscoveryError).toHaveBeenCalledWith(partial ? expect.stringContaining('Additional campaigns could not be checked') : '');
    expect(deps.setGa4ConfigSubStep).toHaveBeenCalledWith('campaigns');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

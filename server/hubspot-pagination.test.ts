import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  HUBSPOT_PAGINATION_ERROR_CODE,
  MAX_HUBSPOT_PAGES,
  nextHubspotPageCursor,
} from './utils/hubspot-pagination';

const routes = readFileSync(join(process.cwd(), 'server', 'routes-oauth.ts'), 'utf8');

describe('HubSpot bounded pagination', () => {
  it('accepts an exactly-at-limit result when the last page has no continuation', () => {
    expect(nextHubspotPageCursor(undefined, MAX_HUBSPOT_PAGES, new Set())).toBeUndefined();
  });

  it('accepts another cursor before the limit and records it', () => {
    const requested = new Set<string>();
    expect(nextHubspotPageCursor('page-25', MAX_HUBSPOT_PAGES - 1, requested)).toBe('page-25');
    expect(requested).toEqual(new Set(['page-25']));
  });

  it('rejects a continuation after the last safe page', () => {
    expect(() => nextHubspotPageCursor('page-26', MAX_HUBSPOT_PAGES, new Set()))
      .toThrowError(expect.objectContaining({ code: HUBSPOT_PAGINATION_ERROR_CODE }));
  });

  it('rejects a repeated provider cursor', () => {
    expect(() => nextHubspotPageCursor('repeated', 2, new Set(['repeated'])))
      .toThrowError(expect.objectContaining({ code: HUBSPOT_PAGINATION_ERROR_CODE }));
  });

  it('guards every confirmed and Pipeline Proxy publishing loop before mutation', () => {
    expect(routes).toContain('const requestedConfirmedRevenueCursors = new Set<string>();');
    expect(routes).toContain('const requestedPipelinePreviewCursors = new Set<string>();');
    expect(routes).toContain('const requestedPipelineSaveCursors = new Set<string>();');
    expect(routes).toContain('const requestedPipelineCursors = new Set<string>();');
    expect(routes.match(/nextHubspotPageCursor\(/g)).toHaveLength(4);
    expect(routes).toContain(`after = platformCtx === 'ga4'`);
    expect(routes).toContain(`afterPipeline = platformCtx === 'ga4'`);
    expect(routes).toContain(`after3 = platformCtx === 'ga4'`);
    expect(routes).toContain('const requireCompletePipelinePagination = String(');
    expect(routes).toContain(`if (error?.code === HUBSPOT_PAGINATION_ERROR_CODE) throw error;`);
    expect(routes).toContain('return res.status(413).json({ success: false, error: error.message, code: error.code });');
    expect(routes).toContain('res.status(paginationIncomplete ? 413 : 500).json({');

    const confirmedGuard = routes.indexOf('requestedConfirmedRevenueCursors)');
    const saveMutation = routes.indexOf('await storage.replaceGa4HubspotRevenueSourceWithRecords', confirmedGuard);
    expect(confirmedGuard).toBeGreaterThanOrEqual(0);
    expect(saveMutation).toBeGreaterThan(confirmedGuard);

    const proxyRoute = routes.indexOf('app.get("/api/hubspot/:campaignId/pipeline-proxy"');
    const proxyGuard = routes.indexOf('requestedPipelineCursors)', proxyRoute);
    const proxyMutation = routes.indexOf('await storage.updateHubspotConnection', proxyRoute);
    expect(proxyGuard).toBeGreaterThan(proxyRoute);
    expect(proxyMutation).toBeGreaterThan(proxyGuard);
  });
});

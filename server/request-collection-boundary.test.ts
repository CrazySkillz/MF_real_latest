import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
import { normalizeStrictUtcDateKey } from './utils/data-transformation';

// Execute the real route schemas without starting the app or contacting storage/providers.
const source = ts.createSourceFile('routes-oauth.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const expressions = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    const name = node.name.getText(source);
    if (['zSelectedValues', 'MAX_SELECTED_VALUES', 'processConnectorDerivedSpend'].includes(name)) expressions.set(name, node.initializer.getText(source));
    if (name === 'rows' && node.initializer.getText(source).includes('safeParse(req.body?.records)')) {
      expressions.set('records', (node.initializer as ts.CallExpression).expression.getText(source).replace(/\.safeParse$/, ''));
    }
  }
  if (ts.isPropertyAssignment(node) && ['campaignValues', 'stageIds'].includes(node.name.getText(source))
    && node.initializer.getText(source).startsWith('z.array(')) expressions.set(node.name.getText(source), node.initializer.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const selectedLimit = Number(expressions.get('MAX_SELECTED_VALUES'));
const specs = [
  { name: 'campaignValues', limit: 500, value: ' Brand ', expected: 'Brand', empty: true },
  { name: 'zSelectedValues', limit: selectedLimit, value: ' Brand ', expected: 'Brand', empty: false },
  { name: 'stageIds', limit: 100, value: ' stage ', expected: 'stage', empty: true },
  { name: 'records', limit: 5000, value: { date: '2026-01-03', spend: '12.34' }, expected: { date: '2026-01-03', spend: '12.34' }, empty: false },
];

describe('existing request collection limits reject before item validation', () => {
  for (const spec of specs) {
    const expression = expressions.get(spec.name);
    if (!expression || !Number.isFinite(spec.limit)) throw new Error(`Missing real schema: ${spec.name}`);
    const schema: z.ZodTypeAny = new Function('z', 'MAX_SELECTED_VALUES', `return ${expression}`)(z, selectedLimit);
    it(`${spec.name}: rejects an oversized list with one size error and no typed-item errors`, () => {
      const input = new Array(spec.limit + 1).fill(null);
      let reads = 0;
      Object.defineProperty(input, 0, { get() { reads++; return null; } });
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Oversized list accepted');
      expect(result.error.issues.map(issue => issue.code)).toEqual(['too_big']);
      // The outer unknown-array pass may copy items once; typed item parsing must not run.
      expect(reads).toBeLessThanOrEqual(1);
    });
    it(`${spec.name}: preserves the exact maximum and transformed values`, () => {
      expect(schema.parse(new Array(spec.limit).fill(spec.value))).toEqual(new Array(spec.limit).fill(spec.expected));
    });
    it(`${spec.name}: still rejects invalid items below the limit`, () => {
      expect(schema.safeParse([null]).success).toBe(false);
    });
    it(`${spec.name}: preserves empty-list behavior`, () => {
      expect(schema.safeParse([]).success).toBe(spec.empty);
    });
    it(`${spec.name}: rejects non-array objects`, () => {
      expect(schema.safeParse({ length: 1, 0: spec.value }).success).toBe(false);
    });
    if (spec.name === 'campaignValues' || spec.name === 'stageIds') {
      it(`${spec.name}: preserves optional and nullable behavior`, () => {
        expect(schema.parse(undefined)).toBeUndefined();
        expect(schema.safeParse(null).success).toBe(spec.name === 'campaignValues');
      });
    }
    if (spec.name === 'records') {
      it('records: preserves numeric spend and strips unknown row fields', () => {
        expect(schema.parse([{ date: '2026-01-03', spend: 0, ignored: 'extra' }])).toEqual([{ date: '2026-01-03', spend: 0 }]);
      });
    }
  }
});

describe('dated spend handler preserves its write boundary', () => {
  async function invoke(body: any, allowed = true) {
    const storage = { replaceSpendSourceWithRecords: vi.fn(async () => ({ id: 'source-a' })) };
    const recalc = vi.fn(), recompute = vi.fn();
    const env = { z, storage, normalizeStrictUtcDateKey, recalcCampaignSpend: recalc, recomputeGA4SpendBeforeResponse: recompute,
      ensureCampaignAccess: vi.fn(async () => allowed ? { currency: 'EUR' } : null) };
    const js = ts.transpileModule(`const handler = ${expressions.get('processConnectorDerivedSpend')};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const handler = new Function(...Object.keys(env), `${js}; return handler;`)(...Object.values(env));
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; } };
    await handler({ params: { id: 'campaign-a' }, body: { amount: 3, currency: 'EUR', platformContext: 'ga4',
      existingSourceId: 'source-a', records: [{ date: '2026-01-02', spend: 1 }, { date: '2026-01-03', spend: '2.00' }], ...body } }, res);
    return { res, storage, recalc, recompute };
  }
  it('preserves scoped replacement, dated amounts, total and recomputation', async () => {
    const { res, storage, recalc, recompute } = await invoke({});
    expect(res.body).toEqual({ success: true, sourceId: 'source-a', spendToDate: 3, currency: 'EUR' });
    expect(storage.replaceSpendSourceWithRecords).toHaveBeenCalledWith('campaign-a', 'source-a', 'connector_derived', 'ga4',
      expect.objectContaining({ campaignId: 'campaign-a', currency: 'EUR', isActive: true }), [
        { campaignId: 'campaign-a', date: '2026-01-02', spend: '1.00', currency: 'EUR', sourceType: 'connector_derived' },
        { campaignId: 'campaign-a', date: '2026-01-03', spend: '2.00', currency: 'EUR', sourceType: 'connector_derived' },
      ]);
    expect(recalc).toHaveBeenCalledExactlyOnceWith('campaign-a');
    expect(recompute).toHaveBeenCalledExactlyOnceWith('campaign-a');
  });
  it.each([
    { records: new Array(5001).fill(null) }, { records: [{ date: '2026-01-03' }] },
    { amount: 4 }, { currency: 'USD' },
  ])('rejects invalid collections or totals before writes', async body => {
    const { res, storage, recalc, recompute } = await invoke(body);
    expect(res.statusCode).toBe(400); expect(res.body.success).toBe(false);
    expect(storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled();
    expect(recalc).not.toHaveBeenCalled(); expect(recompute).not.toHaveBeenCalled();
  });
  it('performs no work when campaign access is denied', async () => {
    const { res, storage, recalc, recompute } = await invoke({}, false);
    expect(res.body).toBeUndefined(); expect(storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled();
    expect(recalc).not.toHaveBeenCalled(); expect(recompute).not.toHaveBeenCalled();
  });
});

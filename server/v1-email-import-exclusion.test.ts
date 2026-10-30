import { readFileSync } from 'node:fs';
import express from 'express';
import type { Server } from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const source = ts.createSourceFile('routes.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const blocked = ['/api/email/inbound/:token', '/api/sendgrid/inbound', '/api/mailgun/inbound', '/api/custom-integration/:campaignId/connect'];
const registrations: ts.CallExpression[] = [];
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.post') registrations.push(node);
  ts.forEachChild(node, visit);
}
visit(source);
const gate = registrations.find(node => ts.isArrayLiteralExpression(node.arguments[0]) && node.arguments[0].getText(source).includes('/api/email/inbound/:token'))!;
const compile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const downstream: string[] = [];
let server: Server, origin: string;

beforeAll(async () => {
  expect(gate).toBeDefined();
  const app = express();
  new Function('app', compile(gate.getText(source)))(app);
  app.use((req, res) => { downstream.push(req.path); res.status(204).end(); });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

describe('V1 automatic email import exclusion', () => {
  it('mounts the exact exclusion before every retained email handler and parser', () => {
    expect((gate.arguments[0] as ts.ArrayLiteralExpression).elements.map(node => (node as ts.StringLiteral).text)).toEqual(blocked);
    for (const route of blocked) {
      const later = registrations.find(node => ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === route);
      expect(later, route).toBeDefined();
      expect(gate.getStart(source)).toBeLessThan(later!.getStart(source));
    }
  });
  for (const route of blocked) for (const suffix of ['', '/']) {
    it(`blocks ${route}${suffix} before downstream route middleware, providers or storage`, async () => {
      const before = downstream.length;
      const url = route.replace(':token', 'existing-capability-token').replace(':campaignId', 'owned-campaign') + suffix;
      const response = await fetch(origin + url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Twilio-Email-Event-Webhook-Signature': 'supplied-signature' },
        body: JSON.stringify({ isTestMode: true, token: 'existing-capability-token' }),
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Automatic email imports are disabled for this release' });
      expect(downstream.length).toBe(before);
    });
  }
  for (const route of ['/api/custom-integration/owned-campaign/upload-pdf', '/api/webhook/custom-integration/existing-token', '/api/custom-integration/connect', '/api/custom-integration/transfer', '/api/platforms/google_analytics/reports']) {
    it(`does not intercept the neighboring POST ${route}`, async () => {
      const response = await fetch(origin + route, { method: 'POST' });
      expect(response.status).toBe(204);
      expect(downstream.at(-1)).toBe(route);
    });
  }
});

describe('V1 retained email setup visibility', () => {
  for (const [file, expectedGuards] of [
    ['client/src/pages/campaigns.tsx', 3],
    ['client/src/pages/campaign-detail.tsx', 2],
    ['client/src/pages/custom-integration-analytics.tsx', 1],
  ] as const) {
    const page = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const conditions: string[] = [];
    let flag = '';
    function inspect(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(page) === 'automaticEmailImportsEnabled') flag = node.initializer!.getText(page);
      if (ts.isJsxExpression(node) && node.expression?.getText(page).startsWith('automaticEmailImportsEnabled &&')) conditions.push(node.expression.getText(page));
      ts.forEachChild(node, inspect);
    }
    inspect(page);
    for (const address of ['', 'existing-address@example.invalid']) it(`${file} hides email setup/forwarding with address ${address || '(empty)'}`, () => {
      expect(flag).toBe('false');
      expect(conditions).toHaveLength(expectedGuards);
      for (const condition of conditions) {
        const render = new Function('React', 'customIntegrationForwardingEmail', 'customIntegrationForwardingEmailDisplay', 'customIntegrationEmail', 'metricsLoading', 'hasMetrics', compile(`const automaticEmailImportsEnabled = ${flag}; return <>${`{${condition}}`}</>;`));
        expect(renderToStaticMarkup(render(React, address, address, address, false, false))).toBe('');
      }
    });
  }
  it('does not advertise forwarding as a ready connection or promise recurring imports', () => {
    const detail = readFileSync('client/src/pages/campaign-detail.tsx', 'utf8');
    expect(detail).toContain('const customIntegrationEmailReady = automaticEmailImportsEnabled &&');
    for (const file of ['client/src/pages/campaigns.tsx', 'client/src/pages/campaign-detail.tsx']) {
      expect(readFileSync(file, 'utf8')).not.toContain('Use automatic imports for future recurring reports.');
    }
  });
  for (const [loading, hasMetrics, email, visible] of [
    [false, false, 'saved@example.invalid', true],
    [true, false, 'saved@example.invalid', false],
    [false, true, 'saved@example.invalid', false],
    [false, false, '', false],
  ] as const) it(`preserves the existing empty-state boundary (${loading}, ${hasMetrics}, ${email || 'no email'})`, () => {
    const file = 'client/src/pages/custom-integration-analytics.tsx';
    const page = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let expression = '';
    function inspect(node: ts.Node) {
      if (ts.isJsxExpression(node) && node.expression?.getText(page).startsWith('!automaticEmailImportsEnabled &&')) expression = node.expression.getText(page);
      ts.forEachChild(node, inspect);
    }
    inspect(page);
    expect(expression).not.toBe('');
    const render = new Function('React', 'metricsLoading', 'hasMetrics', 'customIntegrationEmail', compile(`const automaticEmailImportsEnabled = false; return <>${`{${expression}}`}</>;`));
    const html = renderToStaticMarkup(render(React, loading, hasMetrics, email));
    if (visible) expect(html).toContain('Upload a PDF, CSV, or Excel (.xlsx) report from Campaign Overview');
    else expect(html).toBe('');
  });
});

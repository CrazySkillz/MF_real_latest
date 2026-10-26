import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToString } from "react-dom/server";
import { Router, Route, Switch, Redirect } from "wouter";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Exercise the actual route tree and selection handlers without accounts,
// browser access, application data fetching, or persistence.
const read = (file: string) => process.env.V1_BATCH7_BASELINE
  ? execFileSync("git", ["show", `fa9fb67a:${file}`], { encoding: "utf8" })
  : readFileSync(file, "utf8");
const parse = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(source: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const result: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); };
  visit(source);
  return result;
}
function evaluate(code: string, bindings: Record<string, unknown>) {
  const output = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), output)(...Object.values(bindings));
}
function renderRoute(path: string) {
  const source = parse("client/src/App.tsx");
  const router = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ProtectedRouter") as ts.FunctionDeclaration;
  const returned = router.body!.statements.find(ts.isReturnStatement)!;
  const bindings: Record<string, unknown> = { React, Route, Switch, Redirect, Suspense: React.Suspense };
  for (const node of find(source, node => ts.isJsxAttribute(node) && node.name.getText(source) === "component")) {
    const attribute = node as ts.JsxAttribute;
    const name = (attribute.initializer as ts.JsxExpression).expression!.getText(source);
    bindings[name] = () => React.createElement("main", null, name);
  }
  bindings.ClientProvider = bindings.WelcomeGate = ({ children }: { children: React.ReactNode }) => children;
  bindings.PageLoading = () => null;
  const tree = evaluate(`return (${returned.expression!.getText(source)});`, bindings);
  return renderToString(React.createElement(Router, { ssrPath: path }, tree));
}

describe("V1-125 obsolete Dashboard removal", () => {
  it.each(["/dashboard", "/dashboard/"])("%s has no page or redirect", path => {
    expect(renderRoute(path)).toContain("NotFound");
  });
  it.each([
    ["/", "HomePage"], ["/welcome", "HomePage"], ["/clients", "ClientsPage"],
    ["/campaigns", "Campaigns"], ["/campaigns/test-campaign", "CampaignDetail"],
    ["/campaigns/test-campaign/ga4-metrics", "GA4Metrics"],
    ["/campaigns/test-campaign/performance", "CampaignPerformance"],
    ["/notifications", "Notifications"],
  ])("keeps %s routed to %s", (path, page) => {
    expect(renderRoute(path)).toContain(`>${page}</main>`);
  });
  it.each(["home", "clients"])("%s selects the exact client before opening All Campaigns", page => {
    const source = parse(`client/src/pages/${page}.tsx`);
    const node = find(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === "handleSelectClient")[0] as ts.VariableDeclaration;
    const calls: unknown[] = [];
    const select = evaluate(`return (${node.initializer!.getText(source)});`, {
      setSelectedClientId: (id: string) => calls.push(["client", id]),
      setLocation: (path: string) => calls.push(["route", path]),
    });
    select("client-b");
    expect(calls).toEqual([["client", "client-b"], ["route", "/campaigns"]]);
  });
  it("does not advertise the removed page in the unused welcome preview", () => {
    expect(read("client/src/pages/welcome.tsx")).not.toContain('label: "Dashboard"');
  });
});

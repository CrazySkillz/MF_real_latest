import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import ts from "typescript";

// Exercise the actual read-path boundary without loading database or provider code.
const source = readFileSync("scripts/check-live-number-outputs.ts", "utf8");
const ast = ts.createSourceFile("monitor.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const node = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "browserReadPath");
if (!node) throw new Error("Missing browser read boundary");
const compiled = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const readPath = new Function(compiled + ";return browserReadPath;")() as (path: string, campaign: string, property: string, ids: string[]) => string | null;

it("permits full Trends history only on the selected campaign's read-only daily endpoint", () => {
  const path = readPath("/api/campaigns/a/ga4-daily?days=60&propertyId=123&includeMonthly=1&includeTrendsHistory=1", "a", "123", []);
  expect(path).not.toBeNull();
  const url = new URL(path!, "http://monitor");
  expect(url.pathname).toBe("/api/campaigns/a/ga4-daily");
  expect(Object.fromEntries(url.searchParams)).toEqual({ days: "60", propertyId: "123", includeMonthly: "1", includeTrendsHistory: "1", readOnly: "1" });
  expect(readPath("/api/campaigns/a/ga4-daily?days=60&propertyId=123", "a", "123", [])).toBe("/api/campaigns/a/ga4-daily?days=60&propertyId=123&readOnly=1");
});

it.each([
  "/api/campaigns/b/ga4-daily?includeTrendsHistory=1",
  "/api/campaigns/a/ga4-daily?includeTrendsHistory=1&propertyId=other",
  "/api/campaigns/a/ga4-daily?includeTrendsHistory=1&campaignId=b",
  "/api/campaigns/a/ga4-daily?includeTrendsHistory=0",
  "/api/campaigns/a/ga4-daily?includeTrendsHistory=true",
  "/api/campaigns/a/ga4-daily?includeTrendsHistory=1&includeTrendsHistory=1",
  "/api/campaigns/a/revenue-to-date?includeTrendsHistory=1",
  "/api/clients?includeTrendsHistory=1",
  "/api/campaigns/a/ga4-daily?includeTrendsHistory=1&refresh=1",
  "https://example.test/api/campaigns/a/ga4-daily?includeTrendsHistory=1",
])("rejects broadened or malformed history reads: %s", path => {
  expect(readPath(path, "a", "123", [])).toBeNull();
});

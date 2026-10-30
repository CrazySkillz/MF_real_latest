import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = ts.createSourceFile("reports.tsx", readFileSync("client/src/pages/reports.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "Reports")!;
const statements = component.body!.statements;
const declaration = (name: string) => statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(source) === name))?.getText(source) || "";
const loadEffect = statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === "useEffect" && node.getText(source).includes("reportStorage.getReports()"))!.getText(source);
const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const storageModule = compile(readFileSync("client/src/lib/reportStorage.ts", "utf8"));
const rows = [
  { id: "private-a", campaignId: "campaign-a", name: "Private A report", generatedAt: "2026-10-01", schedule: { recipients: ["owner-a@example.invalid"] } },
  { id: "private-b", campaignId: "campaign-b", name: "Private B report", generatedAt: "2026-10-01" },
];

// Execute the actual storage reader, component effect and final local-list filter.
// No app startup, API request, real account or persistent browser storage is used.
function fixture(campaignContextId: string, liveCampaignFinancialContext: unknown, initialRows: unknown[] = []) {
  const localStorage = { getItem: vi.fn(() => JSON.stringify(rows)), setItem: vi.fn() };
  const exports: any = {};
  new Function("exports", "localStorage", storageModule)(exports, localStorage);
  const events = new Map<string, () => void>();
  const window = { addEventListener: (name: string, callback: () => void) => events.set(name, callback), removeEventListener: (name: string) => events.delete(name) };
  const run = new Function("campaignContextId", "liveCampaignFinancialContext", "reportStorage", "window", "initialRows", compile(`
    let allStoredReports = initialRows;
    let effect;
    const useEffect = callback => { effect = callback; };
    const setAllStoredReports = rows => { allStoredReports = rows; };
    ${declaration("hasCampaignReportAccess")}
    ${loadEffect}
    return { load: () => effect(), visible: () => { ${declaration("localVisibleReports")} return localVisibleReports; } };
  `));
  return { ...run(campaignContextId, liveCampaignFinancialContext, exports.reportStorage, window, initialRows), localStorage, events };
}

describe("Reports browser cache respects verified campaign access", () => {
  it.each([
    ["loading or denied", "campaign-a", undefined],
    ["missing campaign response", "campaign-a", null],
    ["foreign campaign response", "campaign-a", { id: "campaign-b" }],
    ["no campaign context", "", undefined],
  ])("does not read or display private saved reports while %s", (_label, campaignId, campaign) => {
    const f = fixture(campaignId as string, campaign);
    const cleanup = f.load();
    f.events.get("storage")?.();
    f.events.get("reportAdded")?.();
    expect(f.visible()).toEqual([]);
    expect(f.localStorage.getItem).not.toHaveBeenCalled();
    expect(f.localStorage.setItem).not.toHaveBeenCalled();
    cleanup();
    expect(f.events.size).toBe(0);
  });

  it("preserves owned report metadata and storage-event updates without rewriting storage", () => {
    const f = fixture("campaign-a", { id: "campaign-a" });
    f.load();
    expect(f.visible()).toHaveLength(1);
    expect(f.visible()[0]).toMatchObject({ id: "private-a", name: "Private A report", schedule: rows[0].schedule });
    expect(f.visible()[0].generatedAt).toBeInstanceOf(Date);
    f.localStorage.getItem.mockReturnValue(JSON.stringify([...rows, { ...rows[0], id: "new-a" }]));
    f.events.get("reportAdded")?.();
    expect(f.visible().map((row: any) => row.id)).toEqual(["private-a", "new-a"]);
    expect(f.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("hides already-loaded rows before effects run when access is absent", () => {
    const f = fixture("campaign-a", undefined, rows);
    expect(f.visible()).toEqual([]);
    f.load();
    expect(f.visible()).toEqual([]);
    expect(f.localStorage.getItem).not.toHaveBeenCalled();
  });

  it("keeps the permitted second campaign's local reports isolated", () => {
    const f = fixture("campaign-b", { id: "campaign-b" });
    f.load();
    expect(f.visible().map((row: any) => row.id)).toEqual(["private-b"]);
    expect(f.localStorage.setItem).not.toHaveBeenCalled();
  });
});

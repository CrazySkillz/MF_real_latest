import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = ts.createSourceFile("boundary.ts", readFileSync("scripts/ga4-kpi-current-version-test-boundary.ts", "utf8"), ts.ScriptTarget.Latest, true);
const names = ["normalizePath", "testIdentity", "repositoryRelativeFile", "classifyCurrentVersionResults", "runCurrentVersion"];
const code = ts.transpileModule(names.map(name => {
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!declaration) throw Error(`Missing actual CI function ${name}`);
  return declaration.getText(source).replace(/^export /, "");
}).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const manifest = JSON.parse(readFileSync("scripts/ga4-kpi-current-version-test-boundary.json", "utf8"));
function run(options: { extra?: any[]; exit?: number | null; errors?: string[]; deferredFailure?: boolean } = {}) {
  const files = manifest.tests.map((test: any, i: number) => ({ name: resolve(test.file), status: options.deferredFailure && i === 0 ? "failed" : "passed", message: "",
    assertionResults: [{ fullName: test.fullName, status: options.deferredFailure && i === 0 ? "failed" : "passed" }] }));
  files.push(...(options.extra || []));
  const assertions = files.flatMap((file: any) => file.assertionResults);
  const report = { testResults: files, numTotalTests: assertions.length, numPassedTests: assertions.filter((a: any) => a.status === "passed").length,
    numFailedTests: assertions.filter((a: any) => a.status === "failed").length, unhandledErrors: options.errors || [] };
  return new Function("relative", "runVitest", "printFailures", "console", code + "\nreturn runCurrentVersion;")(
    relative, () => ({ report, status: options.exit === undefined ? 0 : options.exit }), () => {}, { log() {}, error() {} },
  )(process.cwd(), manifest);
}
const currentFile = (status: string, assertions: any[], message = "") => ({ name: resolve("server/fixture-current.test.ts"), status, message, assertionResults: assertions });
describe("Batch 8 CI run completion", () => {
  it("accepts fully executed passing tests", () => expect(run()).toBe(0));
  it("preserves the exact existing deferred-failure policy", () => expect(run({ deferredFailure: true, exit: 1 })).toBe(0));
  it("rejects an ordinary current assertion failure", () => expect(run({ exit: 1, extra: [currentFile("failed", [{ fullName: "required", status: "failed" }])] })).toBe(1));
  it("rejects a file that fails during import", () => expect(run({ exit: 1, extra: [currentFile("failed", [], "Cannot import module")] })).toBe(1));
  it("rejects a teardown failure after passing assertions", () => expect(run({ exit: 1, extra: [currentFile("failed", [{ fullName: "required", status: "passed" }], "teardown failed")] })).toBe(1));
  it.each(["skipped", "pending", "todo"])("rejects a current test left %s", status => expect(run({ extra: [currentFile("passed", [{ fullName: "required", status }])] })).toBe(1));
  it.each([null, 2])("rejects a terminated or abnormal runner (%s)", exit => expect(run({ exit })).toBe(1));
  it("rejects an unsuccessful runner with no assertion failures", () => expect(run({ exit: 1 })).toBe(1));
  it.each([false, true])("rejects unhandled errors even with deferred failures (%s)", deferredFailure => expect(run({ exit: 1, deferredFailure, errors: ["unhandled rejection"] })).toBe(1));
});

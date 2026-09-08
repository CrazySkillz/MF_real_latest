import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const file = ts.createSourceFile("ga4-metrics.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Execute the actual page callbacks, rather than copying their implementation into tests.
function mutationOptions(name: string, bindings: Record<string, any>) {
  let options: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name && node.initializer && ts.isCallExpression(node.initializer)) {
      options = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!options) throw new Error(`Missing mutation ${name}`);
  const compiled = ts.transpileModule(`const options = ${options.getText(file)}; exports.options = options;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: any = {};
  new Function(...Object.keys(bindings), "exports", compiled)(...Object.values(bindings), exports);
  return exports.options;
}

describe.each([
  ["createKPIMutation", "setShowKPIDialog"],
  ["updateKPIMutation", "setShowKPIDialog"],
  ["createBenchmarkMutation", "setShowCreateBenchmark"],
  ["updateBenchmarkMutation", "setShowCreateBenchmark"],
])("%s non-blocking pending UI", (name, dialog) => {
  const setup = () => {
    const bindings: Record<string, any> = {
      campaignId: "campaign-a", currentCampaignIdRef: { current: "campaign-a" },
      setShowKPIDialog: vi.fn(), setShowCreateBenchmark: vi.fn(), kpiForm: { reset: vi.fn() },
      setEditingKPI: vi.fn(), setKpiEditInitialValues: vi.fn(), setSelectedBenchmarkTemplate: vi.fn(),
      setBenchmarkEditInitialValues: vi.fn(), setEditingBenchmark: vi.fn(), setNewBenchmark: vi.fn(),
      toast: vi.fn(), queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
      refreshNotificationQueries: vi.fn().mockResolvedValue(undefined), SELECT_UNIT: "select-unit",
      console: { error: vi.fn(), warn: vi.fn() },
    };
    return { bindings, options: mutationOptions(name, bindings) };
  };

  it("closes the form without resetting inputs, claiming success, or refreshing unconfirmed values", () => {
    const { bindings, options } = setup();
    expect(options.onMutate()).toEqual({ campaignId: "campaign-a" });
    expect(bindings[dialog]).toHaveBeenCalledWith(false);
    expect(bindings.kpiForm.reset).not.toHaveBeenCalled();
    expect(bindings.setNewBenchmark).not.toHaveBeenCalled();
    expect(bindings.setEditingKPI).not.toHaveBeenCalled();
    expect(bindings.setEditingBenchmark).not.toHaveBeenCalled();
    expect(bindings.toast).not.toHaveBeenCalled();
    expect(bindings.queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(bindings.refreshNotificationQueries).not.toHaveBeenCalled();
  });

  it("restores the entered form on a failed request", () => {
    const { bindings, options } = setup();
    const context = options.onMutate();
    options.onError(new Error("Save failed"), {}, context);
    expect(bindings[dialog]).toHaveBeenLastCalledWith(true);
    expect(bindings.kpiForm.reset).not.toHaveBeenCalled();
    expect(bindings.setNewBenchmark).not.toHaveBeenCalled();
    expect(bindings.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("does not reopen a previous campaign's form after navigation", () => {
    const { bindings, options } = setup();
    const context = options.onMutate();
    bindings.currentCampaignIdRef.current = "campaign-b";
    options.onError(new Error("Save failed"), {}, context);
    expect(bindings[dialog]).toHaveBeenCalledTimes(1);
    expect(bindings[dialog]).toHaveBeenLastCalledWith(false);
  });

  it("keeps confirmation and list/notification refresh on server success", () => {
    const { bindings, options } = setup();
    options.onMutate();
    options.onSuccess();
    expect(bindings[dialog]).toHaveBeenLastCalledWith(false);
    expect(bindings.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/successfully/) }));
    expect(bindings.queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(bindings.refreshNotificationQueries).toHaveBeenCalledTimes(1);
  });
});

it("keeps pending status honest and protects create/edit/delete controls from conflicting writes", () => {
  expect(source).toContain('role="status" aria-live="polite"');
  expect(source).toContain("Saving changes… You can keep viewing this page.");
  expect(source).toContain("const isAnalyticsSavePending = createKPIMutation.isPending || updateKPIMutation.isPending || createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending;");
  expect(source).toContain("const isKpiSubmitDisabled = isAnalyticsSavePending ||");
  expect(source).toContain("const isBenchmarkSubmitDisabled = isAnalyticsSavePending ||");
  expect(source.match(/disabled=\{isAnalyticsSavePending\}/g)).toHaveLength(5);
  expect(source).toContain("disabled={deleteKPIMutation.isPending || isAnalyticsSavePending}");
});

import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestReportSaveFile, writeReportSaveFile } from "../client/src/lib/pdfExport";

afterEach(() => vi.unstubAllGlobals());

describe("report Save As destination", () => {
  it("requests Downloads synchronously from the click and lets the browser choose the filename", async () => {
    const handle = {} as FileSystemFileHandle;
    const picker = vi.fn(async () => handle);
    const browser = { showSaveFilePicker: picker };
    vi.stubGlobal("window", browser);
    const result = requestReportSaveFile("Trend_Check.pdf");
    expect(picker).toHaveBeenCalledExactlyOnceWith({ startIn: "downloads", suggestedName: "Trend_Check.pdf", types: [{ description: "PDF report", accept: { "application/pdf": [".pdf"] } }] });
    expect(picker.mock.contexts[0]).toBe(browser);
    await expect(result).resolves.toBe(handle);
  });
  it("keeps the normal download fallback when the picker is absent", async () => {
    vi.stubGlobal("window", {});
    await expect(requestReportSaveFile("report.pdf")).resolves.toBeUndefined();
  });
  it.each(["SecurityError", "NotSupportedError"])("retains fallback if the browser rejects the picker with %s", async name => {
    vi.stubGlobal("window", { showSaveFilePicker: vi.fn().mockRejectedValue(new DOMException("unavailable", name)) });
    await expect(requestReportSaveFile("report.pdf")).resolves.toBeUndefined();
  });
  it("returns a distinct cancellation without falling back to an automatic download", async () => {
    vi.stubGlobal("window", { showSaveFilePicker: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")) });
    await expect(requestReportSaveFile("report.pdf")).resolves.toBeNull();
  });
  it("surfaces unexpected picker failures", async () => {
    vi.stubGlobal("window", { showSaveFilePicker: vi.fn().mockRejectedValue(Error("picker failed")) });
    await expect(requestReportSaveFile("report.pdf")).rejects.toThrow("picker failed");
  });
  it("writes the exact PDF bytes, then closes the selected file", async () => {
    const operations: string[] = [];
    const pdf = new Blob(["%PDF-1.7 fixture"], { type: "application/pdf" });
    const writer = { write: vi.fn(async () => { operations.push("write"); }), close: vi.fn(async () => { operations.push("close"); }), abort: vi.fn() };
    const handle = { createWritable: vi.fn(async () => writer) } as unknown as FileSystemFileHandle;
    await writeReportSaveFile(handle, pdf);
    expect(writer.write).toHaveBeenCalledWith(pdf);
    expect(operations).toEqual(["write", "close"]);
    expect(writer.abort).not.toHaveBeenCalled();
  });
  it.each(["write", "close"])("aborts the stream and reports a %s failure", async method => {
    const writer = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), abort: vi.fn().mockResolvedValue(undefined) };
    writer[method as "write" | "close"].mockRejectedValue(Error("disk failed"));
    await expect(writeReportSaveFile({ createWritable: async () => writer } as unknown as FileSystemFileHandle, new Blob())).rejects.toThrow("disk failed");
    expect(writer.abort).toHaveBeenCalledOnce();
    if (method === "write") expect(writer.close).not.toHaveBeenCalled();
  });
});

const source = ts.createSourceFile("reports.tsx", readFileSync("client/src/pages/reports.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function binding(name: string, env: Record<string, unknown>) {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) found.push(node.initializer.getText(source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(found).toHaveLength(1);
  return new Function(...Object.keys(env), ts.transpileModule(`return (${found[0]});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(env));
}
const report = { name: "Trend Check", campaignId: "campaign-a", type: "trend-analysis", selectedSections: ["trend-analysis:overview"], selectedMetrics: [] };
function campaignDownload(pick: any, fetch: any, write = vi.fn()) {
  return binding("downloadCampaignReportPdf", { campaignContextId: "campaign-a", requestReportSaveFile: pick, writeReportSaveFile: write, fetch, normalizeTrendReportSections: (value: any) => value, CAMPAIGN_DEEPDIVE_REPORT_PLATFORM: "campaign_deepdive" });
}
describe("actual Campaign Diagnostics download handler", () => {
  it.each([false, true])("cancels before any PDF or snapshot request, saved report = %s", async saved => {
    const fetch = vi.fn(), write = vi.fn();
    const download = campaignDownload(async () => null, fetch, write);
    await expect(download({ ...report, ...(saved ? { backendReportId: "report-a" } : {}) })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
  it("waits for file selection before fetching and writes the exact validated response", async () => {
    let accept!: (handle: unknown) => void;
    const selected = new Promise(resolve => { accept = resolve; });
    const blob = new Blob(["%PDF-1.7 fixture"], { type: "application/pdf" });
    const fetch = vi.fn(async () => ({ ok: true, blob: async () => blob })), write = vi.fn();
    const task = campaignDownload(() => selected, fetch, write)(report);
    expect(fetch).not.toHaveBeenCalled();
    const handle = {};
    accept(handle);
    await expect(task).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/campaigns/campaign-a/custom-report-pdf", expect.objectContaining({ method: "POST", credentials: "include" }));
    expect(write).toHaveBeenCalledExactlyOnceWith(handle, blob);
  });
  it.each(["http", "invalid-pdf"])("does not open a write stream after %s failure", async failure => {
    const write = vi.fn();
    const fetch = vi.fn(async () => failure === "http" ? { ok: false, json: async () => ({ error: "Not allowed" }) } : { ok: true, blob: async () => new Blob(["<html>error</html>"]) });
    await expect(campaignDownload(async () => ({}), fetch, write)(report)).rejects.toThrow(failure === "http" ? "Not allowed" : "PDF is invalid");
    expect(write).not.toHaveBeenCalled();
  });
  it("saves the existing authenticated snapshot PDF path for a saved report", async () => {
    const blob = new Blob(["%PDF-1.7 snapshot"]), handle = {}, write = vi.fn();
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ snapshot: { id: "snapshot-a" } }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => blob });
    await expect(campaignDownload(async () => handle, fetch, write)({ ...report, backendReportId: "report-a" })).resolves.toBe(true);
    expect(fetch.mock.calls).toEqual([
      ["/api/platforms/campaign_deepdive/reports/report-a/snapshots", { method: "POST", credentials: "include" }],
      ["/api/report-snapshots/snapshot-a/pdf", { credentials: "include" }],
    ]);
    expect(write).toHaveBeenCalledExactlyOnceWith(handle, blob);
  });
  it("does not silently switch downloads when the chosen file cannot be written", async () => {
    const fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["%PDF-"]) }));
    await expect(campaignDownload(async () => ({}), fetch, vi.fn().mockRejectedValue(Error("disk full")))(report)).rejects.toThrow("disk full");
  });
  it("preserves the existing anchor download when the picker is unsupported", async () => {
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } });
    const urls = { createObjectURL: vi.fn(() => "blob:fixture"), revokeObjectURL: vi.fn() };
    vi.stubGlobal("URL", urls);
    const blob = new Blob(["%PDF-1.7 fixture"]);
    await expect(campaignDownload(async () => undefined, async () => ({ ok: true, blob: async () => blob }))(report)).resolves.toBe(true);
    expect(link.download).toMatch(/^Trend_Check_\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:fixture");
  });
  it("leaves the create form and its fields intact after cancelling Save As", async () => {
    const setPending = vi.fn(), close = vi.fn(), reset = vi.fn(), storage = { getReports: vi.fn() };
    const busy = { current: false };
    const save = binding("saveReport", { reportSaveInProgress: busy, setReportSavePending: setPending, setReportSaveError: vi.fn(), buildReportPayload: () => report, scheduleEnabled: false, editingReportId: null, campaignContextId: "campaign-a", CAMPAIGN_DEEPDIVE_REPORT_PLATFORM: "campaign_deepdive", downloadCampaignReportPdf: async () => false, reportStorage: storage, setShowCreateDialog: close, resetForm: reset });
    await save();
    expect(busy.current).toBe(false);
    expect(setPending.mock.calls).toEqual([[true], [false]]);
    expect(close).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(storage.getReports).not.toHaveBeenCalled();
  });
});

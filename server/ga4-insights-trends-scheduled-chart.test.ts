import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { transpileModule, ScriptTarget } from "typescript";
import { jsPDF } from "jspdf";
import { addGA4InsightsDateDays } from "../shared/ga4-insights";

const source = readFileSync("server/ga4-scheduled-report-pdf.ts", "utf8");
const start = source.indexOf("  const drawTrendChart =");
const end = source.indexOf("  const formatMoney = payload.formatMoney;", start);
if (start < 0 || end < 0) throw new Error("Scheduled Trends chart boundary missing");

function render(rows: Array<{ date: string; value: number }>) {
  const doc = new jsPDF(), lines: number[][] = [];
  const circles = vi.spyOn(doc, "circle"), text = vi.spyOn(doc, "text");
  let blue = false;
  const setDrawColor = doc.setDrawColor.bind(doc), line = doc.line.bind(doc);
  vi.spyOn(doc, "setDrawColor").mockImplementation(((...args: any[]) => {
    blue = args.join(",") === "59,130,246"; return (setDrawColor as any)(...args);
  }) as any);
  vi.spyOn(doc, "line").mockImplementation(((...args: any[]) => {
    if (blue) lines.push(args.slice(0, 4)); return (line as any)(...args);
  }) as any);
  const sectionTitle = vi.fn(), checkPage = vi.fn();
  const body = transpileModule(`let y = 30; const MX = 15, CW = 180;
    ${source.slice(start, end)}; return drawTrendChart;`, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText;
  const draw = new Function("doc", "sectionTitle", "checkPage", "COLORS", "addGA4InsightsDateDays", body)(
    doc, sectionTitle, checkPage, { white: [255, 255, 255], cardBorder: [200, 200, 200], textTert: [100, 100, 100] }, addGA4InsightsDateDays);
  draw("Trends", rows.map(row => ({ ...row, label: row.date.slice(5) })));
  return { doc, lines, circles, text, sectionTitle };
}

describe("Scheduled Insights Trends chart", () => {
  it("does not join unrecorded dates or compress the missing calendar interval", () => {
    const result = render([1, 2, 10, 11].map(day => ({ date: `2026-10-${String(day).padStart(2, "0")}`, value: day })));
    expect(result.lines).toHaveLength(2);
    const dayWidth = result.lines[0][2] - result.lines[0][0];
    expect((result.lines[1][0] - result.lines[0][2]) / dayWidth).toBeCloseTo(8);
    if (!process.env.V1_BATCH7_BASELINE) writeFileSync("audit-temp/trends-fixed-scheduled-gap-oct28.pdf", Buffer.from(result.doc.output("arraybuffer")));
  });
  it("shows a single recorded zero as a visible point and leaves empty history empty", () => {
    const result = render([{ date: "2026-10-27", value: 0 }]);
    expect(result.sectionTitle).toHaveBeenCalledOnce();
    expect(result.circles).toHaveBeenCalledOnce();
    expect(result.lines).toHaveLength(0);
    expect(render([]).sectionTitle).not.toHaveBeenCalled();
  });
  it("continues connecting consecutive dates including recorded zeros", () => {
    const result = render([1, 2, 3].map(day => ({ date: `2026-10-0${day}`, value: day === 2 ? 0 : 5 })));
    expect(result.lines).toHaveLength(2);
    expect(result.circles).toHaveBeenCalledTimes(3);
  });
});

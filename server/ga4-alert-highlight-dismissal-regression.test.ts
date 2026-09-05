import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { dismissGA4AlertHighlightOnOutsideClick } from "../client/src/lib/ga4-alert-highlight";

describe("GA4 alert deep-link highlight dismissal", () => {
  it.each([
    ["kpis", "ga4-kpi-kpi-1"],
    ["benchmarks", "ga4-benchmark-benchmark-1"],
  ])("removes the %s highlight after a click outside its card", (tab, cardId) => {
    const insideTarget = {} as EventTarget;
    const outsideTarget = {} as EventTarget;
    const replaceUrl = vi.fn();
    const findCard = vi.fn((id: string) => ({ contains: (target: Node) => id === cardId && target === insideTarget }));
    const itemId = tab === "kpis" ? "kpi-1" : "benchmark-1";
    const href = `https://app.test/campaigns/campaign-1/ga4-metrics?tab=${tab}&highlight=${itemId}&kept=1#section`;

    expect(dismissGA4AlertHighlightOnOutsideClick(insideTarget, href, findCard, replaceUrl)).toBe(false);
    expect(replaceUrl).not.toHaveBeenCalled();
    expect(dismissGA4AlertHighlightOnOutsideClick(outsideTarget, href, findCard, replaceUrl)).toBe(true);
    expect(replaceUrl).toHaveBeenCalledWith(`/campaigns/campaign-1/ga4-metrics?tab=${tab}&kept=1#section`);
  });

  it("does not affect highlights outside the GA4 KPI and Benchmark route", () => {
    const replaceUrl = vi.fn();
    const findCard = vi.fn();

    expect(dismissGA4AlertHighlightOnOutsideClick(null, "https://app.test/notifications?highlight=1", findCard, replaceUrl)).toBe(false);
    expect(dismissGA4AlertHighlightOnOutsideClick(null, "https://app.test/campaigns/1/ga4-metrics?tab=overview&highlight=1", findCard, replaceUrl)).toBe(false);
    expect(replaceUrl).not.toHaveBeenCalled();
  });

  it("keeps the protected app listener connected to the tested dismissal logic", () => {
    const app = readFileSync(join(process.cwd(), "client", "src", "App.tsx"), "utf-8");

    expect(app).toContain("dismissGA4AlertHighlightOnOutsideClick(");
    expect(app).toContain('document.addEventListener("click", handlePageClick, true);');
    expect(app).toContain('document.removeEventListener("click", handlePageClick, true);');
  });
});

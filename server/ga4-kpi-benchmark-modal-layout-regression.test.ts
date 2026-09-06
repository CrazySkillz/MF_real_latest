import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("GA4 KPI and Benchmark modal layout stability", () => {
  it("prevents Radix scroll-lock compensation from shifting either editor", () => {
    const page = read("client/src/pages/ga4-metrics.tsx");
    const styles = read("client/src/index.css");
    const marker = "data-ga4-kpi-benchmark-editor-dialog";

    expect(page.match(new RegExp(marker, "g"))).toHaveLength(2);
    expect(styles).toContain(`body[data-scroll-locked]:has([${marker}])`);
    expect(styles.slice(styles.indexOf(`body[data-scroll-locked]:has([${marker}])`)))
      .toMatch(/margin-right:\s*0\s*!important/);
  });
});

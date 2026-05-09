import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const GA4_METRICS_FILE = join(__dirname, "..", "client", "src", "pages", "ga4-metrics.tsx");

function readGa4Metrics(): string {
  return readFileSync(GA4_METRICS_FILE, "utf-8");
}

describe("GA4 KPI edit modal regression guard", () => {
  it("preselects the matching KPI template and avoids focusing the name field in edit mode", () => {
    const source = readGa4Metrics();

    expect(source).toContain("const getKpiTemplateForEdit = (kpi: any) =>");
    expect(source).toContain("setSelectedKPITemplate(getKpiTemplateForEdit(kpi));");
    expect(source).toContain("if (editingKPI) event.preventDefault();");
  });
});

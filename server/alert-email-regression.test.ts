import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const EMAIL_SERVICE_FILE = join(__dirname, "services", "email-service.ts");

function readEmailService(): string {
  return readFileSync(EMAIL_SERVICE_FILE, "utf-8");
}

describe("alert email regression guard", () => {
  it("keeps KPI and Benchmark alert emails unbranded by the old header", () => {
    const source = readEmailService();

    expect(source).toContain("Review this ${data.type} in your MimoSaaS dashboard");
    expect(source).toContain("This is an automated alert from MimoSaaS");
    expect(source).not.toContain("Performance Alert</h1>");
    expect(source).not.toContain("linear-gradient(135deg, #667eea 0%, #764ba2 100%)");
    expect(source).not.toContain("Review this ${data.type} in your MetricMind dashboard");
    expect(source).not.toContain("This is an automated alert from MetricMind");
  });
});

import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { cardValue } from "../scripts/live-number-browser-checks";

describe("monitor card values", () => {
  it("reads labels containing an information icon and rejects ambiguous values", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent('<div><div>Total Users<svg width="12" height="12"><path d="M0 0"/></svg></div><div class="text-2xl">1,149</div></div>');
      expect(await cardValue(page, "Total Users")).toBe("1,149");
      await page.setContent('<div><div>Total Users<svg width="12" height="12"/></div><div class="text-2xl">1,149</div><div class="text-2xl">900</div></div>');
      expect(await cardValue(page, "Total Users")).toBeNull();
    } finally { await browser.close(); }
  });
});

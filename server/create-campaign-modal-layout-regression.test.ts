import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Create Campaign modal layout stability", () => {
  it("prevents only this wizard's redundant body margin compensation", () => {
    const page = read("client/src/pages/campaigns.tsx");
    const styles = read("client/src/index.css");
    const marker = "data-create-campaign-dialog";

    expect(page).toContain(`<DialogContent ${marker} className={`);
    expect(page).toContain('max-h-[90vh] overflow-hidden flex flex-col');
    expect(page).toContain('overflow-y-auto flex-1 min-h-0 scrollbar-hide px-1');
    expect(styles).toMatch(
      new RegExp(
        `body\\[data-scroll-locked\\]:has\\(\\[${marker}\\]\\)\\s*\\{\\s*margin-right:\\s*0\\s*!important;\\s*\\}`,
      ),
    );
    expect(styles).not.toMatch(
      /body\[data-scroll-locked\]\s*\{[^}]*margin-right:\s*0\s*!important/,
    );
  });
});

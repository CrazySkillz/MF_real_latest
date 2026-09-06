import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Create Client modal layout stability", () => {
  it("prevents only this dialog's redundant body margin compensation", () => {
    const modal = read("client/src/components/modals/create-client-modal.tsx");
    const styles = read("client/src/index.css");
    const marker = "data-create-client-dialog";

    expect(modal).toContain(`<DialogContent ${marker} className="sm:max-w-md">`);
    expect(modal).toContain("autoFocus");
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

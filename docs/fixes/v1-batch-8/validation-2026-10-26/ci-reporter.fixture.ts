import { expect, it } from "vitest";
it("records a deliberately controlled runner outcome", async () => {
  if (process.env.CI_RECEIPT_FIXTURE === "unhandled") {
    setTimeout(() => { void Promise.reject(new Error("CONTROLLED_UNHANDLED_FIXTURE")); }, 0);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  expect(process.env.CI_RECEIPT_FIXTURE === "assertion-failure").toBe(false);
});

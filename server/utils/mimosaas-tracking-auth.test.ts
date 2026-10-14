import { describe, expect, it } from "vitest";
import {
  createMimosaasTrackingCredentials,
  hashMimosaasTrackingSecret,
  verifyMimosaasTrackingSecret,
} from "./mimosaas-tracking-auth";

describe("Mimosaas Tracking credentials", () => {
  it("generates unique public IDs and high-entropy secrets", () => {
    const first = createMimosaasTrackingCredentials();
    const second = createMimosaasTrackingCredentials();

    expect(first.trackingPublicId).toMatch(/^mtk_[a-f0-9]{32}$/);
    expect(first.trackingSecret).toMatch(/^mts_[A-Za-z0-9_-]{43}$/);
    expect(first.trackingPublicId).not.toBe(second.trackingPublicId);
    expect(first.trackingSecret).not.toBe(second.trackingSecret);
  });

  it("stores a one-way hash and verifies only the matching secret", () => {
    const credentials = createMimosaasTrackingCredentials();

    expect(credentials.trackingSecretHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(credentials.trackingSecretHash).not.toContain(credentials.trackingSecret);
    expect(verifyMimosaasTrackingSecret(credentials.trackingSecret, credentials.trackingSecretHash)).toBe(true);
    expect(verifyMimosaasTrackingSecret(createMimosaasTrackingCredentials().trackingSecret, credentials.trackingSecretHash)).toBe(false);
    expect(verifyMimosaasTrackingSecret(credentials.trackingSecret, "invalid")).toBe(false);
  });

  it("invalidates the old secret after rotation", () => {
    const oldCredentials = createMimosaasTrackingCredentials();
    const rotatedCredentials = createMimosaasTrackingCredentials();

    expect(verifyMimosaasTrackingSecret(oldCredentials.trackingSecret, rotatedCredentials.trackingSecretHash)).toBe(false);
    expect(verifyMimosaasTrackingSecret(rotatedCredentials.trackingSecret, rotatedCredentials.trackingSecretHash)).toBe(true);
    expect(hashMimosaasTrackingSecret(rotatedCredentials.trackingSecret)).toBe(rotatedCredentials.trackingSecretHash);
  });
});

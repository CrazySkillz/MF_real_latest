import { createHash, randomBytes, timingSafeEqual } from "crypto";

const TRACKING_SECRET_PATTERN = /^mts_[A-Za-z0-9_-]{43}$/;
const TRACKING_SECRET_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

export const createMimosaasTrackingSecret = (): string =>
  `mts_${randomBytes(32).toString("base64url")}`;

export const hashMimosaasTrackingSecret = (secret: string): string =>
  `sha256:${createHash("sha256").update(secret, "utf8").digest("hex")}`;

export const createMimosaasTrackingCredentials = () => {
  const secret = createMimosaasTrackingSecret();
  return {
    trackingPublicId: `mtk_${randomBytes(16).toString("hex")}`,
    trackingSecret: secret,
    trackingSecretHash: hashMimosaasTrackingSecret(secret),
  };
};

export const verifyMimosaasTrackingSecret = (secret: string, storedHash: string | null | undefined): boolean => {
  if (!TRACKING_SECRET_PATTERN.test(secret) || !storedHash || !TRACKING_SECRET_HASH_PATTERN.test(storedHash)) return false;
  const provided = Buffer.from(hashMimosaasTrackingSecret(secret), "utf8");
  const expected = Buffer.from(storedHash, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

import { randomBytes, timingSafeEqual } from "crypto";

const INTERNAL_AUTO_REFRESH_TOKEN = randomBytes(32).toString("hex");
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function getInternalAutoRefreshToken(): string {
  return INTERNAL_AUTO_REFRESH_TOKEN;
}

export function isInternalAutoRefreshRequest(req: any): boolean {
  const remote = String(req?.socket?.remoteAddress || req?.ip || "").trim();
  if (!LOOPBACK_HOSTS.has(remote)) return false;

  const header = String(req?.headers?.["x-internal-auto-refresh-token"] || "").trim();
  if (!header || header.length !== INTERNAL_AUTO_REFRESH_TOKEN.length) return false;
  if (Buffer.byteLength(header) !== Buffer.byteLength(INTERNAL_AUTO_REFRESH_TOKEN)) return false;

  return timingSafeEqual(Buffer.from(header), Buffer.from(INTERNAL_AUTO_REFRESH_TOKEN));
}

import { randomBytes, timingSafeEqual } from "crypto";
import type { GA4RefreshWriteInput } from "./storage";

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

export function getInternalGA4RefreshWriteInput(req: any): GA4RefreshWriteInput {
  const value = req?.headers?.["x-internal-ga4-refresh-scope"];
  if (value === undefined) return {};
  if (!isInternalAutoRefreshRequest(req) || typeof value !== "string" || value.length > 2048) {
    throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  }
  let scope: any;
  try { scope = JSON.parse(value); } catch { throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST"); }
  if (![scope?.campaignId, scope?.ownerId, scope?.reportingDate, scope?.work?.id, scope?.work?.leaseToken]
    .every(field => typeof field === "string" && field.trim())) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  return { refreshScope: { campaignId: scope.campaignId, ownerId: scope.ownerId, reportingDate: scope.reportingDate,
    work: { id: scope.work.id, leaseToken: scope.work.leaseToken } } };
}

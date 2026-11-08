// Read-only completeness and delivery-audit checks. No reconciliation, dismissal,
// alert creation, retry, email send, or audit-row update is performed here.
import { expectedOutputNumbers, expectedTargetNumbers } from "./live-number-output-checks";
import { monitorHash, numberOrNull, type LiveNumberSnapshot, type NumberCheck } from "./live-number-checks";

export function checkNotificationCoverage(snapshot: LiveNumberSnapshot, response: any, now = new Date()): NumberCheck[] {
  const checks: NumberCheck[] = [], section = "Notification completeness", e = expectedOutputNumbers(snapshot, now);
  const visible = Array.isArray(response) ? response : response?.notifications;
  if (!Array.isArray(visible) || !Array.isArray(snapshot.rows.notifications) || !Array.isArray(snapshot.rows.emailAlertEvents))
    return [{ section, code: "NOTIFICATION_CAPTURE_UNVERIFIED", status: "unverified" }];
  const metadata = (row: any) => { try { return typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {}; } catch { return null; } };
  const targets = expectedTargetNumbers(snapshot, now);
  for (const target of targets) {
    const row = target.row, subject = monitorHash(row.id), kind = target.kind === "kpis" ? "kpiId" : "benchmarkId";
    const items = visible.filter((n: any) => n.campaignId === snapshot.campaign.id && metadata(n)?.[kind] === row.id);
    if (!row.alertsEnabled) { checks.push({ section, code: "DISABLED_RULE_HAS_NO_ALERT", subject, status: items.length === 0 ? "passed" : "difference" }); continue; }
    if (!target.verified || numberOrNull(row.alertThreshold) === null || !["above", "below", "equals"].includes(row.alertCondition || "below")) {
      checks.push({ section, code: "RULE_INPUTS_UNVERIFIED", subject, status: "unverified" }); continue;
    }
    // Only the newest KPI for a GA4 metric remains eligible (the application
    // contract). Rank independently, including its deterministic ID tie-break.
    const peers = targets.filter(t => t.kind === "kpis" && t.verified && t.identity === target.identity).sort((a, b) =>
      (Date.parse(b.row.createdAt) || 0) - (Date.parse(a.row.createdAt) || 0) || (Date.parse(b.row.updatedAt) || 0) - (Date.parse(a.row.updatedAt) || 0) || String(b.row.id).localeCompare(String(a.row.id)));
    const eligible = target.kind !== "kpis" || peers[0]?.row.id === row.id;
    const sufficient = !(["conversion_rate", "engagement_rate"].includes(target.identity) && (e.totals.sessions || 0) < 1)
      && !(target.identity === "cpa" && (e.totals.conversions || 0) < 1)
      && !(["roas", "roi"].includes(target.identity) && (e.spend || 0) <= 0);
    const threshold = Number(row.alertThreshold), value = target.current;
    const breached = eligible && sufficient && (row.alertCondition === "above" ? value > threshold : row.alertCondition === "equals" ? Math.abs(value - threshold) < 0.01 : value < threshold);
    const history = snapshot.rows.notifications.filter(n => n.campaignId === snapshot.campaign.id && metadata(n)?.[kind] === row.id);
    const current = history.filter(n => !metadata(n)?.resolved && !metadata(n)?.dismissedAt);
    const dismissed = history.some(n => metadata(n)?.dismissedAt && !metadata(n)?.resolved);
    // Explicit dismissal hides an episode; it must not be reported as a missing
    // alert. Current non-dismissed rows must still be visible exactly once.
    const wanted = breached && (current.length > 0 || !dismissed) ? 1 : 0;
    checks.push({ section, code: wanted ? "REQUIRED_ALERT_PRESENT" : "NO_SPURIOUS_ALERT", subject, status: items.length === wanted ? "passed" : "difference" });
    checks.push({ section, code: "NO_DUPLICATE_ACTIVE_ALERT", subject, status: current.length <= 1 ? "passed" : "difference" });
    if (wanted && current.length === 0) checks.push({ section, code: "BREACHED_RULE_MISSING_PERSISTED_ALERT", subject, status: "difference" });
  }
  for (const event of snapshot.rows.emailAlertEvents) {
    const subject = monitorHash(event.id), state = event.deliveryStatus;
    const age = now.getTime() - Date.parse(event.lastAttemptAt || event.createdAt);
    const recovered = snapshot.rows.emailAlertEvents.some(later => later.kind === event.kind && later.entityType === event.entityType && later.entityId === event.entityId
      && later.to === event.to && later.deliveryStatus === "delivered" && Date.parse(later.createdAt) > Date.parse(event.createdAt));
    const failed = state === "failed" && !recovered || state === "retry_scheduled" && Date.parse(event.nextAttemptAt) < now.getTime() - 15 * 60_000
      || ["pending", "sending"].includes(state) && age > 15 * 60_000;
    checks.push({ section: "Notification email audit", code: "NO_FAILED_OR_STUCK_DELIVERY", subject, status: failed ? "difference" : "passed" });
    const known = ["pending", "sending", "accepted", "pending_delivery", "delivered", "failed", "retry_scheduled", "skipped"].includes(state);
    checks.push({ section: "Notification email audit", code: "DELIVERY_STATE_EVIDENCE", subject, status: !known ? "unverified" : state === "delivered" && !(event.deliveredAt && event.providerResponseId) ? "difference" : "passed" });
    if (["accepted", "pending_delivery"].includes(state)) checks.push({ section: "Notification email audit", code: "PROVIDER_ACCEPTED_DELIVERY_UNCONFIRMED", subject, status: "unverified" });
  }
  if (!targets.length) checks.push({ section, code: "NO_CONFIGURED_TARGET_RULES", status: "passed" });
  if (!snapshot.rows.emailAlertEvents.length) checks.push({ section: "Notification email audit", code: "NO_DELIVERY_EVENTS", status: "passed" });
  return checks;
}

export async function checkNotificationEmailContent(snapshot: LiveNumberSnapshot, now = new Date()): Promise<NumberCheck[]> {
  const { emailService } = await import("./services/email-service");
  const original = emailService.sendEmail, checks: NumberCheck[] = [];
  let captured: any;
  // This singleton is private to the monitor process. Capture before the
  // transport/audit boundary, restoring it even when a template throws.
  emailService.sendEmail = async options => { captured = options; return false; };
  try {
    for (const target of expectedTargetNumbers(snapshot, now).filter(t => t.row.alertsEnabled && t.row.emailNotifications)) {
      const section = "Notification email content", subject = monitorHash(target.row.id), row = target.row;
      if (!target.verified || numberOrNull(row.alertThreshold) === null) { checks.push({ section, code: "EMAIL_INPUTS_UNVERIFIED", subject, status: "unverified" }); continue; }
      captured = undefined;
      await emailService.sendAlertEmail("monitor@example.invalid", { type: target.kind === "kpis" ? "kpi" : "benchmark", name: row.name,
        currentValue: target.current, thresholdValue: Number(row.alertThreshold), condition: row.alertCondition || "below", unit: row.unit, campaignName: snapshot.campaign.name },
        { campaignId: snapshot.campaign.id, entityId: row.id });
      const formatted = (value: number) => row.unit === "ratio" ? `${value.toFixed(2)}x` : row.unit === "%" ? `${Math.round(value * 10) / 10}%`
        : row.unit === "$" || /^[A-Z]{3}$/.test(row.unit || "") ? new Intl.NumberFormat("en-US", { style: "currency", currency: row.unit === "$" ? "USD" : row.unit }).format(value)
        : row.unit === "seconds" ? `${value.toFixed(1)}s` : value.toLocaleString("en-US", { maximumSignificantDigits: 21 });
      checks.push({ section, code: "CURRENT_VALUE_AND_THRESHOLD", subject, status: captured?.html?.includes(formatted(target.current)) && captured?.html?.includes(`Alert threshold value: ${formatted(Number(row.alertThreshold))}`) ? "passed" : "difference" });
      checks.push({ section, code: "CAMPAIGN_TARGET_AND_TRANSPORT_BLOCKED", subject, status: captured?.auditContext?.campaignId === snapshot.campaign.id && captured?.auditContext?.entityId === row.id && captured?.to === "monitor@example.invalid" && captured?.subject?.includes(row.name) ? "passed" : "difference" });
    }
    return checks;
  } finally { emailService.sendEmail = original; }
}

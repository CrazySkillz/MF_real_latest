import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("notification visibility regression guard", () => {
  it("hides resolved alert notifications from visible notification lists", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("return !!meta?.dismissedAt || !!meta?.resolved;");
    expect(routesFile).toContain("const visible = rows.map((r: any) => r.n).filter((n: any) => !isNotificationDismissed(n));");
    expect(routesFile).toContain('if (!ownedIds.includes(String((n as any)?.campaignId || "")) || isNotificationDismissed(n)) return null;');
  });

  it("hides orphaned or cross-campaign performance alert notifications", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('const isPerformanceAlert = String(n.type || "") === "performance-alert";');
    expect(routesFile).toContain('if (!kpi || String((kpi as any).campaignId || "") !== String(n.campaignId || "")) return null;');
    expect(routesFile).toContain('if (!benchmark || String((benchmark as any).campaignId || "") !== String(n.campaignId || "")) return null;');
    expect(routesFile).toContain("if (isPerformanceAlert) return null;");
    expect(routesFile).toContain('if (String((n as any)?.type || "") !== "performance-alert") return n;');
    expect(routesFile).toContain("const kpi = await storage.getKPI(String(meta.kpiId)).catch(() => undefined as any);");
    expect(routesFile).toContain("const benchmark = await storage.getBenchmark(String(meta.benchmarkId)).catch(() => undefined as any);");
    expect(routesFile).toContain('return enrichPerformanceAlertNotification(n, kpi, "kpi");');
    expect(routesFile).toContain('return enrichPerformanceAlertNotification(n, benchmark, "benchmark");');
  });

  it("hides performance alert notifications when the linked row no longer breaches", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('import { resolveCampaignCurrentValueForAlert } from "./utils/campaign-current-values";');
    expect(routesFile).toContain("const isAlertRowBreached = async (row: any): Promise<boolean> => {");
    expect(routesFile).toContain("const resolved = await resolveCampaignCurrentValueForAlert(row);");
    expect(routesFile).toContain("if (isPerformanceAlert && !(await isAlertRowBreached(kpi))) return null;");
    expect(routesFile).toContain("if (isPerformanceAlert && !(await isAlertRowBreached(benchmark))) return null;");
    expect(routesFile).toContain("&& await isAlertRowBreached(kpi)");
    expect(routesFile).toContain("&& await isAlertRowBreached(benchmark)");
  });

  it("deduplicates visible performance alerts by linked KPI or Benchmark", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const visiblePerformanceAlertKey = (n: any): string | null => {");
    expect(routesFile).toContain('if (meta?.kpiId) return `kpi:${String(meta.kpiId)}`;');
    expect(routesFile).toContain('if (meta?.benchmarkId) return `benchmark:${String(meta.benchmarkId)}`;');
    expect(routesFile).toContain("const dedupeVisiblePerformanceAlerts = (rows: any[]) => {");
    expect(routesFile).toContain("const scoped = dedupeVisiblePerformanceAlerts(scopedRows.filter(Boolean));");
    expect(routesFile).toContain("return res.json(dedupeVisiblePerformanceAlerts(list));");
  });

  it("prevents stale KPI and Benchmark alert creation from missing campaigns or non-breaches", () => {
    const kpiNotificationsFile = readFileSync(
      join(process.cwd(), "server", "kpi-notifications.ts"),
      "utf-8"
    );
    const benchmarkNotificationsFile = readFileSync(
      join(process.cwd(), "server", "benchmark-notifications.ts"),
      "utf-8"
    );

    expect(kpiNotificationsFile).toContain("if (!shouldTriggerAlert(kpi)) {");
    expect(kpiNotificationsFile).toContain("await resolveKPIAlerts(String(kpi.id), 'cleared');");
    expect(kpiNotificationsFile).toContain('const campaignId = String(kpi.campaignId || "").trim();');
    expect(kpiNotificationsFile).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => undefined);");
    expect(kpiNotificationsFile).toContain("if (!campaign) {");
    expect(kpiNotificationsFile).toContain("if (usesSingleActiveAlert) await resolveKPIAlerts(String(kpi.id), 'cleared');");
    expect(kpiNotificationsFile).toContain('const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";');
    expect(benchmarkNotificationsFile).toContain('const campaignId = String(b.campaignId || "").trim();');
    expect(benchmarkNotificationsFile).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => undefined);");
    expect(benchmarkNotificationsFile).toContain("if (!campaign) {");
    expect(benchmarkNotificationsFile).toContain('if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");');
    expect(benchmarkNotificationsFile).toContain('const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";');
  });

  it("prevents stale or misparsed email alert sends", () => {
    const alertMonitoringFile = readFileSync(
      join(process.cwd(), "server", "services", "alert-monitoring.ts"),
      "utf-8"
    );

    expect(alertMonitoringFile).toContain("private parseAlertNumber(value: unknown): number {");
    expect(alertMonitoringFile).toContain("private async getExistingCampaignName(campaignId: unknown): Promise<string | null> {");
    expect(alertMonitoringFile).toContain("const campaignName = await this.getExistingCampaignName((kpi as any).campaignId);");
    expect(alertMonitoringFile).toContain("const campaignName = await this.getExistingCampaignName((benchmark as any).campaignId);");
    expect(alertMonitoringFile).toContain("if (!campaignName) return false;");
    expect(alertMonitoringFile).toContain("if (!campaignName) continue;");
    expect(alertMonitoringFile).toContain("const currentValue = this.parseAlertNumber(kpi.currentValue);");
    expect(alertMonitoringFile).toContain("const thresholdValue = this.parseAlertNumber(kpi.alertThreshold);");
    expect(alertMonitoringFile).toContain("const currentValue = this.parseAlertNumber(benchmark.currentValue);");
    expect(alertMonitoringFile).toContain("const thresholdValue = this.parseAlertNumber(benchmark.alertThreshold);");
  });

  it("waits for GA4 KPI and Benchmark in-app alert reconciliation before create/update responses", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    const kpiCreateStart = routesFile.indexOf('app.post("/api/platforms/:platformType/kpis"');
    const kpiCreateEnd = routesFile.indexOf('app.patch("/api/platforms/:platformType/kpis/:kpiId"', kpiCreateStart);
    const kpiUpdateEnd = routesFile.indexOf('app.delete("/api/platforms/:platformType/kpis/:kpiId"', kpiCreateEnd);
    const kpiCreateRoute = routesFile.slice(kpiCreateStart, kpiCreateEnd);
    const kpiUpdateRoute = routesFile.slice(kpiCreateEnd, kpiUpdateEnd);

    expect(kpiCreateRoute).toContain("if (String(platformType || '').toLowerCase() === 'google_analytics')");
    expect(kpiCreateRoute).toContain("await checkPerformanceAlerts();");
    expect(kpiCreateRoute.indexOf("await checkPerformanceAlerts();")).toBeLessThan(kpiCreateRoute.indexOf("res.json(responseKpi || kpi);"));
    expect(kpiUpdateRoute).toContain("if (String((okKpi as any)?.platformType || '').toLowerCase() === 'google_analytics')");
    expect(kpiUpdateRoute).toContain("await checkPerformanceAlerts();");
    expect(kpiUpdateRoute.indexOf("await checkPerformanceAlerts();")).toBeLessThan(kpiUpdateRoute.indexOf("res.json(responseKPI || updatedKPI);"));

    const benchmarkCreateStart = routesFile.indexOf('app.post("/api/benchmarks"');
    const benchmarkCreateEnd = routesFile.indexOf('app.put("/api/benchmarks/:id"', benchmarkCreateStart);
    const benchmarkUpdateEnd = routesFile.indexOf('app.delete("/api/benchmarks/:id"', benchmarkCreateEnd);
    const benchmarkCreateRoute = routesFile.slice(benchmarkCreateStart, benchmarkCreateEnd);
    const benchmarkUpdateRoute = routesFile.slice(benchmarkCreateEnd, benchmarkUpdateEnd);

    expect(benchmarkCreateRoute).toContain("await checkBenchmarkPerformanceAlerts();");
    expect(benchmarkCreateRoute.indexOf("await checkBenchmarkPerformanceAlerts();")).toBeLessThan(benchmarkCreateRoute.indexOf("res.status(201).json(benchmark);"));
    expect(benchmarkUpdateRoute).toContain("await checkBenchmarkPerformanceAlerts();");
    expect(benchmarkUpdateRoute.indexOf("await checkBenchmarkPerformanceAlerts();")).toBeLessThan(benchmarkUpdateRoute.indexOf("res.json(benchmark);"));
  });

  it("refreshes notifications after GA4 KPI and Benchmark create/update/delete mutations", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("const refreshNotificationQueries = useCallback(async () => {");
    expect(ga4MetricsFile).toContain('await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });');
    expect(ga4MetricsFile).toContain('await queryClient.refetchQueries({ queryKey: ["/api/notifications"], exact: true });');
    expect(ga4MetricsFile.match(/await refreshNotificationQueries\(\);/g) || []).toHaveLength(6);

    const createKpi = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const createKPIMutation"), ga4MetricsFile.indexOf("const updateKPIMutation"));
    const updateKpi = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const updateKPIMutation"), ga4MetricsFile.indexOf("// Delete KPI mutation"));
    const deleteKpi = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const deleteKPIMutation"), ga4MetricsFile.indexOf("// GA4 Reports"));
    const createBenchmark = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const createBenchmarkMutation"), ga4MetricsFile.indexOf("const updateBenchmarkMutation"));
    const updateBenchmark = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const updateBenchmarkMutation"), ga4MetricsFile.indexOf("const deleteBenchmarkMutation"));
    const deleteBenchmark = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const deleteBenchmarkMutation"), ga4MetricsFile.indexOf("// Benchmark handlers"));

    for (const mutation of [createKpi, updateKpi, deleteKpi, createBenchmark, updateBenchmark, deleteBenchmark]) {
      expect(mutation).toContain("await refreshNotificationQueries();");
    }
  });

  it("refreshes existing active KPI and Benchmark alert rows after edits", () => {
    const kpiNotificationsFile = readFileSync(
      join(process.cwd(), "server", "kpi-notifications.ts"),
      "utf-8"
    );
    const benchmarkNotificationsFile = readFileSync(
      join(process.cwd(), "server", "benchmark-notifications.ts"),
      "utf-8"
    );

    expect(kpiNotificationsFile).toContain("const preservedAlert = preservedAlertId");
    expect(kpiNotificationsFile).toContain("await storage.updateNotification(String(preservedAlert.id), {");
    expect(kpiNotificationsFile).toContain("message: nextMessage,");
    expect(kpiNotificationsFile).toContain("campaignName: campaign.name,");
    expect(kpiNotificationsFile).toContain("metadata: JSON.stringify({");
    expect(benchmarkNotificationsFile).toContain("const preservedAlert = preservedAlertId");
    expect(benchmarkNotificationsFile).toContain("await storage.updateNotification(String(preservedAlert.id), {");
    expect(benchmarkNotificationsFile).toContain("message: nextMessage,");
    expect(benchmarkNotificationsFile).toContain("campaignName: campaign.name,");
    expect(benchmarkNotificationsFile).toContain("metadata: JSON.stringify({");
  });

  it("hides selected KPI and Benchmark alerts when linked rows are deleted", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const platformKpiDelete = routesFile.slice(
      routesFile.indexOf('app.delete("/api/platforms/:platformType/kpis/:kpiId"'),
      routesFile.indexOf('app.post("/api/campaigns/:id/kpis"', routesFile.indexOf('app.delete("/api/platforms/:platformType/kpis/:kpiId"'))
    );
    const campaignKpiDelete = routesFile.slice(
      routesFile.indexOf('app.delete("/api/campaigns/:id/kpis/:kpiId"'),
      routesFile.indexOf("// Campaign-level Benchmark routes", routesFile.indexOf('app.delete("/api/campaigns/:id/kpis/:kpiId"'))
    );
    const campaignBenchmarkDelete = routesFile.slice(
      routesFile.indexOf('app.delete("/api/campaigns/:campaignId/benchmarks/:benchmarkId"'),
      routesFile.indexOf("// Get KPI analytics", routesFile.indexOf('app.delete("/api/campaigns/:campaignId/benchmarks/:benchmarkId"'))
    );
    const platformBenchmarkDelete = routesFile.slice(
      routesFile.indexOf('app.delete("/api/platforms/:platformType/benchmarks/:benchmarkId"'),
      routesFile.indexOf("// Platform Reports routes", routesFile.indexOf('app.delete("/api/platforms/:platformType/benchmarks/:benchmarkId"'))
    );

    expect(platformKpiDelete).toContain('if (String(meta?.kpiId || "") === String(kpiId))');
    expect(platformKpiDelete).toContain('await softHideNotification(n, getActorId(req as any) || "system", "kpi_deleted");');
    expect(campaignKpiDelete).toContain('if (String(meta?.kpiId || "") === String(kpiId))');
    expect(campaignKpiDelete).toContain('await softHideNotification(n, getActorId(req as any) || "system", "kpi_deleted");');
    expect(campaignBenchmarkDelete).toContain('if (String(meta?.benchmarkId || "") === String(benchmarkId))');
    expect(campaignBenchmarkDelete).toContain('await softHideNotification(n, getActorId(req as any) || "system", "benchmark_deleted");');
    expect(platformBenchmarkDelete).toContain('if (String(meta?.benchmarkId || "") === String(benchmarkId))');
    expect(platformBenchmarkDelete).toContain('await softHideNotification(n, getActorId(req as any) || "system", "benchmark_deleted");');
  });

  it("runs campaign-level Benchmark alert reconciliation before create/update responses", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const createStart = routesFile.indexOf('app.post("/api/campaigns/:id/benchmarks"');
    const createEnd = routesFile.indexOf('app.patch("/api/campaigns/:campaignId/benchmarks/:benchmarkId"', createStart);
    const updateEnd = routesFile.indexOf('app.delete("/api/campaigns/:campaignId/benchmarks/:benchmarkId"', createEnd);
    const createRoute = routesFile.slice(createStart, createEnd);
    const updateRoute = routesFile.slice(createEnd, updateEnd);
    const createAlertIndex = createRoute.indexOf("await checkBenchmarkPerformanceAlerts();");
    const updateAlertIndex = updateRoute.indexOf("await checkBenchmarkPerformanceAlerts();");

    expect(createStart).toBeGreaterThan(-1);
    expect(createEnd).toBeGreaterThan(createStart);
    expect(updateEnd).toBeGreaterThan(createEnd);
    expect(createAlertIndex).toBeGreaterThan(-1);
    expect(updateAlertIndex).toBeGreaterThan(-1);
    expect(createAlertIndex).toBeLessThan(createRoute.indexOf("res.json(benchmark);", createAlertIndex));
    expect(updateAlertIndex).toBeLessThan(updateRoute.indexOf("res.json(benchmark);", updateAlertIndex));
  });

  it("refreshes notifications after campaign-level KPI and Benchmark mutations", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain("const refreshNotificationQueries = async () => {");
    expect(campaignDetail).toContain('await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });');
    expect(campaignDetail).toContain('await queryClient.refetchQueries({ queryKey: ["/api/notifications"], exact: true });');
    expect(campaignDetail.match(/await refreshNotificationQueries\(\);/g) || []).toHaveLength(6);
  });

  it("opens performance-alert bell clicks on the selected Notifications page detail", () => {
    const navigationFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "layout", "navigation.tsx"),
      "utf-8"
    );
    const alertRedirectIndex = navigationFile.indexOf('if (notification.type === "performance-alert") {');
    const metadataIndex = navigationFile.indexOf("let metadata = notification.metadata;", alertRedirectIndex);

    expect(alertRedirectIndex).toBeGreaterThan(-1);
    expect(metadataIndex).toBeGreaterThan(alertRedirectIndex);
    expect(navigationFile.slice(alertRedirectIndex, metadataIndex)).toContain(
      "navigateFromBell(`/notifications?selected=${encodeURIComponent(String(notification.id))}`);"
    );
    expect(navigationFile.slice(alertRedirectIndex, metadataIndex)).toContain("return;");
    expect(navigationFile.slice(alertRedirectIndex, metadataIndex)).not.toContain("/notifications?highlight=");
    expect(navigationFile).toContain("Open details");
  });

  it("keeps bell dismiss clicks separate from row navigation and keeps unread count on notifications query", () => {
    const navigationFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "layout", "navigation.tsx"),
      "utf-8"
    );
    const deleteButtonStart = navigationFile.indexOf('data-testid={`button-delete-notification-popover-${notification.id}`}');
    const deleteHandlerStart = navigationFile.lastIndexOf("onClick={(e) => {", deleteButtonStart);
    const deleteHandler = navigationFile.slice(deleteHandlerStart, deleteButtonStart);

    expect(navigationFile).toContain('queryKey: ["/api/notifications"]');
    expect(navigationFile).toContain("const unreadCount = notifications.filter(n => !n.read).length;");
    expect(deleteHandler).toContain("e.preventDefault();");
    expect(deleteHandler).toContain("e.stopPropagation();");
    expect(deleteHandler).toContain("deleteNotificationMutation.mutate(notification.id);");
    expect(deleteHandler).not.toContain("handleNotificationClick(notification)");
  });

  it("refetches bell notifications after read, clear, and dismiss mutations", () => {
    const navigationFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "layout", "navigation.tsx"),
      "utf-8"
    );

    expect(navigationFile).toContain("const refreshNotificationQueries = async () => {");
    expect(navigationFile).toContain('await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });');
    expect(navigationFile).toContain('await queryClient.refetchQueries({ queryKey: ["/api/notifications"], exact: true });');
    expect(navigationFile.match(/await refreshNotificationQueries\(\);/g) || []).toHaveLength(4);
  });

  it("focuses selected or legacy highlighted notification rows on the Notifications page", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain('import { useLocation, useSearch } from "wouter";');
    expect(notificationsPage).toContain("const search = useSearch();");
    expect(notificationsPage).toContain("const notificationSearchParams = new URLSearchParams(search);");
    expect(notificationsPage).toContain('const selectedNotificationId = notificationSearchParams.get("selected") || notificationSearchParams.get("highlight") || "";');
    expect(notificationsPage).toContain('setSearchTerm("");');
    expect(notificationsPage).toContain('setPriorityFilter("all");');
    expect(notificationsPage).toContain('setReadFilter("all");');
    expect(notificationsPage).toContain('setClientFilter("all");');
    expect(notificationsPage).toContain('setDateFilter("all");');
    expect(notificationsPage).toContain("const selectedFilteredIndex = selectedNotificationId");
    expect(notificationsPage).toContain("const selectedInFilteredResults = selectedFilteredIndex >= 0;");
    expect(notificationsPage).toContain("if (!selectedInFilteredResults) {");
    expect(notificationsPage).toContain("const selectedNotification = selectedNotificationId");
    expect(notificationsPage).toContain("const selectedNotificationVisible = selectedNotificationId");
    expect(notificationsPage).toContain("if (!selectedNotificationId || isLoading || !selectedNotificationVisible) return;");
    expect(notificationsPage).toContain("document.getElementById(`notification-${selectedNotificationId}`)");
    expect(notificationsPage).toContain('el.scrollIntoView({ block: "center", behavior: "smooth" });');
    expect(notificationsPage).toContain("const isSelectedNotification = String(notification.id) === selectedNotificationId;");
    expect(notificationsPage).toContain('id={`notification-${notification.id}`}');
    expect(notificationsPage).toContain('aria-pressed={isSelectedNotification}');
    expect(notificationsPage).toContain('data-selected={isSelectedNotification ? "true" : "false"}');
    expect(notificationsPage).toContain('${isSelectedNotification ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5" : ""}');
  });

  it("does not scroll the page when selecting an already visible notification row", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain('import { useState, useEffect, useRef } from "react";');
    expect(notificationsPage).toContain("const suppressNextSelectedScrollRef = useRef(false);");
    expect(notificationsPage).toContain("if (suppressNextSelectedScrollRef.current) {");
    expect(notificationsPage).toContain("suppressNextSelectedScrollRef.current = false;");
    expect(notificationsPage).toContain("if (String(notificationId) === selectedNotificationId) return;");
    expect(notificationsPage).toContain("suppressNextSelectedScrollRef.current = true;");
    expect(notificationsPage).toContain("setLocation(`/notifications?selected=${encodeURIComponent(String(notificationId))}`);");
  });

  it("shows a safe empty state when a selected notification is unavailable", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("const selectedNotificationMissing = Boolean(selectedNotificationId && !isLoading && !selectedNotification);");
    expect(notificationsPage).toContain('data-testid="selected-notification-missing-detail"');
    expect(notificationsPage).toContain("Selected alert is no longer active");
    expect(notificationsPage).toContain("This alert may have been dismissed, resolved, deleted, or is no longer available in your active notifications.");
  });

  it("renders Notifications as a two-pane triage layout with selected detail identity", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain('data-testid="notifications-triage-layout"');
    expect(notificationsPage).toContain('data-testid="notifications-active-alerts-list"');
    expect(notificationsPage).toContain("Active alerts");
    expect(notificationsPage).toContain('data-testid="selected-notification-detail-panel"');
    expect(notificationsPage).toContain('data-testid="selected-notification-detail"');
    expect(notificationsPage).toContain("data-selected-notification-id={String(selectedNotification.id)}");
    expect(notificationsPage).toContain('data-testid="selected-notification-empty-detail"');
    expect(notificationsPage).toContain("Select an alert");
  });

  it("keeps filtering local and preserves a clear empty active-alert state", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("const filteredNotifications = notifications.filter(notification => {");
    expect(notificationsPage).toContain("return matchesSearch && matchesPriority && matchesRead && matchesClient && matchesDate;");
    expect(notificationsPage).toContain("const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);");
    expect(notificationsPage).toContain("No active alerts found");
    expect(notificationsPage).toContain("No active alerts match your current filters.");
  });

  it("does not show a second Notifications page loading message after the route loader", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("{isLoading ? null : filteredNotifications.length === 0 ? (");
    expect(notificationsPage).not.toContain("Loading notifications...");
  });

  it("preserves metadata action URLs from the Notifications page view action", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );
    const actionStart = notificationsPage.indexOf("const rawUrl = String(metadata?.actionUrl || \"\");");
    const actionEnd = notificationsPage.indexOf("if (metadata?.actionUrl)", actionStart);
    const actionSection = notificationsPage.slice(actionStart, actionEnd);

    expect(actionStart).toBeGreaterThan(-1);
    expect(actionEnd).toBeGreaterThan(actionStart);
    expect(actionSection).toContain("const baseUrl = rawUrl");
    expect(actionSection).toContain("new URL(rawUrl, window.location.origin)");
    expect(actionSection).toContain("setLocation(`${baseUrl.pathname}${baseUrl.search}`);");
    expect(actionSection).not.toContain("linkedin-analytics");
  });

  it("enriches performance-alert notification details from linked KPI and Benchmark rows", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('const enrichPerformanceAlertNotification = (n: any, row: any, itemType: "kpi" | "benchmark") => {');
    expect(routesFile).toContain('const itemLabel = itemType === "benchmark" ? "Benchmark" : "KPI";');
    expect(routesFile).toContain("itemName: row?.name,");
    expect(routesFile).toContain("platformLabel,");
    expect(routesFile).toContain("currentValue: row?.currentValue,");
    expect(routesFile).toContain("thresholdValue: row?.alertThreshold,");
    expect(routesFile).toContain('alertCondition: row?.alertCondition || "below",');
  });

  it("renders KPI and Benchmark selected-alert detail actions without implying dismissal resolves the breach", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("const renderAlertDetail = (notification: Notification) => {");
    expect(notificationsPage).toContain('const isPerformanceAlertDetail = notification.type === "performance-alert" && Boolean(getAlertItemType(metadata, notification.title));');
    expect(notificationsPage).toContain('const itemType = getAlertItemType(metadata, notification.title) || "Alert";');
    expect(notificationsPage).toContain("actionLabel: `Open ${itemType}`,");
    expect(notificationsPage).toContain("setLocation(actionUrl);");
    expect(notificationsPage).toContain('data-testid={`button-open-selected-alert-${notification.id}`}');
    expect(notificationsPage).toContain("Edit alert settings");
    expect(notificationsPage).toContain("Hides this notification from active views. It does not resolve the underlying KPI/Benchmark breach.");
    expect(notificationsPage).toContain("deleteNotificationMutation.mutate(notification.id)");
  });

  it("keeps active alert status separate from read state without exposing history rows", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain('statusLabel: "Active",');
    expect(notificationsPage).toContain('readStateLabel: notification.read ? "Read" : "Unread",');
    expect(notificationsPage).toContain("Alert status");
    expect(notificationsPage).toContain("Read state");
    expect(notificationsPage).toContain('<Label htmlFor="read-filter">Read state</Label>');
    expect(notificationsPage).toContain("All Read States");
    expect(notificationsPage).not.toContain('statusLabel: notification.read ? "Active, read" : "Active, unread"');
    expect(notificationsPage).not.toContain('<Label htmlFor="read-filter">Status</Label>');
    expect(notificationsPage).not.toContain('value="history"');
  });

  it("uses platform-neutral alert metadata and fails unknown item types closed to generic detail", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("const formatPlatformLabel = (value: unknown) => {");
    expect(notificationsPage).toContain('if (normalized === "ga4" || normalized === "google_analytics") return "GA4";');
    expect(notificationsPage).toContain('if (normalized === "google_ads") return "Google Ads";');
    expect(notificationsPage).toContain('if (normalized === "custom-integration" || normalized === "custom_integration") return "Custom Integration";');
    expect(notificationsPage).toContain('return raw.split(/[_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");');
    expect(notificationsPage).toContain("const getAlertItemType = (metadata: any, title: string) => {");
    expect(notificationsPage).toContain('if (itemType === "benchmark" || metadata?.benchmarkId || /Benchmark Alert:/i.test(title)) return "Benchmark";');
    expect(notificationsPage).toContain('if (itemType === "kpi" || metadata?.kpiId || /KPI Alert:/i.test(title)) return "KPI";');
    expect(notificationsPage).toContain("return null;");
    expect(notificationsPage).toContain("platformLabel: formatPlatformLabel(metadata?.platformLabel || metadata?.platformType),");
    expect(notificationsPage).not.toContain('metadata?.itemType === "benchmark"');
  });

  it("keeps GA4 KPI alert action URLs campaign-scoped and fail-closed", () => {
    const kpiNotificationsFile = readFileSync(
      join(process.cwd(), "server", "kpi-notifications.ts"),
      "utf-8"
    );

    expect(kpiNotificationsFile).toContain('const campaignId = String((kpi as any)?.campaignId || "").trim();');
    expect(kpiNotificationsFile).toContain('const id = String((kpi as any)?.id || "").trim();');
    expect(kpiNotificationsFile).toContain('if (platform === "google_analytics") {');
    expect(kpiNotificationsFile).toContain("? `/campaigns/${campaignId}/ga4-metrics?tab=kpis&highlight=${id}`");
    expect(kpiNotificationsFile).toContain(': "/notifications";');
    expect(kpiNotificationsFile).not.toContain("`/ga4-metrics?tab=kpis&highlight=${kpi.id}`");
  });
});

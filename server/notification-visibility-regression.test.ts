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

  it("hides and refreshes KPI and Benchmark notifications after client and campaign deletion", () => {
    const storageFile = readFileSync(
      join(process.cwd(), "server", "storage.ts"),
      "utf-8"
    );
    const homeFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "home.tsx"),
      "utf-8"
    );
    const campaignsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaigns.tsx"),
      "utf-8"
    );

    expect(storageFile).toContain("private async deleteCampaignChildren(campaignId: string, tx: any = db): Promise<void> {");
    expect(storageFile).toContain("await tx.update(notifications)");
    expect(storageFile).toContain("'dismissalReason', 'campaign_deleted'");
    expect(storageFile).toContain("await this.deleteCampaignChildren(String(campaign.id), tx);");
    expect(homeFile).toContain("onSuccess: async (_data, clientId) => {");
    expect(homeFile).toContain('await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });');
    expect(homeFile).toContain('await queryClient.refetchQueries({ queryKey: ["/api/notifications"], exact: true });');
    expect(campaignsFile).toContain("onSuccess: async () => {");
    expect(campaignsFile).toContain('await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });');
    expect(campaignsFile).toContain('await queryClient.refetchQueries({ queryKey: ["/api/notifications"], exact: true });');
  });

  it("routes top bar bell clicks directly to Notifications and disables it on the Notifications page", () => {
    const navigationFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "layout", "navigation.tsx"),
      "utf-8"
    );

    expect(navigationFile).toContain("const [location, setLocation] = useLocation();");
    expect(navigationFile).toContain('const isNotificationsPage = location === "/notifications" || location.startsWith("/notifications?");');
    expect(navigationFile).toContain('data-testid="button-notifications"');
    expect(navigationFile).toContain('onClick={() => setLocation("/notifications")}');
    expect(navigationFile).toContain("disabled={isNotificationsPage}");
    expect(navigationFile).toContain('aria-current={isNotificationsPage ? "page" : undefined}');
    expect(navigationFile).toContain('<Bell className="w-4 h-4" />');
    expect(navigationFile).not.toContain("text-green-600");
    expect(navigationFile).toContain('aria-label={hasActiveKpiBenchmarkBreach ? "Open Notifications, active KPI or Benchmark breach" : "Open Notifications"}');
    expect(navigationFile).not.toContain("PopoverTrigger");
    expect(navigationFile).not.toContain("PopoverContent");
    expect(navigationFile).not.toContain("navigateFromBell");
    expect(navigationFile).not.toContain("/notifications?selected=");
  });

  it("shows a dot-only top bar breach indicator without Notifications read-state highlighting", () => {
    const navigationFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "layout", "navigation.tsx"),
      "utf-8"
    );
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(navigationFile).toContain('queryKey: ["/api/notifications"]');
    expect(navigationFile).toContain("const hasActiveKpiBenchmarkBreach = notifications.some((notification) => {");
    expect(navigationFile).toContain('if (notification.type !== "performance-alert") return false;');
    expect(navigationFile).toContain('const itemType = String(metadata?.itemType || "").toLowerCase();');
    expect(navigationFile).toContain('return itemType === "kpi" || itemType === "benchmark" || Boolean(metadata?.kpiId || metadata?.benchmarkId);');
    expect(navigationFile).toContain("{hasActiveKpiBenchmarkBreach && (");
    expect(navigationFile).toContain('<span className="relative inline-flex">');
    expect(navigationFile).toContain('className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-background"');
    expect(navigationFile).toContain('data-testid="notification-breach-indicator"');
    expect(navigationFile).toContain('aria-hidden="true"');
    expect(navigationFile).not.toContain("const unreadCount = notifications.filter(n => !n.read).length;");
    expect(navigationFile).not.toContain("{unreadCount > 99 ? '99+' : unreadCount}");
    expect(notificationsPage).not.toContain('!notification.read ? "border-l-4 border-l-blue-500 bg-blue-50/30" : ""');
    expect(notificationsPage).not.toContain("{/* Unread state is shown via left blue border + subtle background */}");
    expect(notificationsPage).not.toContain("border-l-blue-500");
    expect(notificationsPage).not.toContain("bg-blue-50/30");
  });

  it("does not expose top bar dropdown notification mutation actions", () => {
    const navigationFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "layout", "navigation.tsx"),
      "utf-8"
    );

    expect(navigationFile).not.toContain("markAsReadMutation");
    expect(navigationFile).not.toContain("markAllAsReadMutation");
    expect(navigationFile).not.toContain("deleteNotificationMutation");
    expect(navigationFile).not.toContain("/api/notifications/all/clear");
    expect(navigationFile).not.toContain("button-delete-notification-popover");
    expect(navigationFile).not.toContain("Mark all as read");
    expect(navigationFile).not.toContain("Clear all");
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
    expect(notificationsPage).toContain('data-selected={isSelectedNotification ? "true" : "false"}');
    expect(notificationsPage).toContain('${isSelectedNotification ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5" : ""}');
  });

  it("does not make full notification rows clickable", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).not.toContain('role="button"');
    expect(notificationsPage).not.toContain("aria-pressed={isSelectedNotification}");
    expect(notificationsPage).not.toContain("const selectNotification = (notificationId: string) => {");
    expect(notificationsPage).not.toContain("onClick={() => selectNotification(notification.id)}");
    expect(notificationsPage).not.toContain("onKeyDown={(e) => {");
    expect(notificationsPage).not.toContain("cursor-pointer");
    expect(notificationsPage).not.toContain("hover:shadow-md");
  });

  it("shows a safe empty state when a selected notification is unavailable", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("const selectedNotificationMissing = Boolean(selectedNotificationId && !isLoading && !selectedNotification);");
    expect(notificationsPage).toContain('data-testid="selected-notification-missing-alert"');
    expect(notificationsPage).toContain("Selected alert is no longer active");
    expect(notificationsPage).toContain("This alert may have been dismissed, resolved, deleted, or is no longer available in your active notifications.");
  });

  it("renders Notifications as a full-width alert list without the selected-detail side panel", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain('data-testid="notifications-active-alerts-list"');
    expect(notificationsPage).toContain('<section className="min-w-0" data-testid="notifications-active-alerts-list">');
    expect(notificationsPage).not.toContain('data-testid="notifications-triage-layout"');
    expect(notificationsPage).not.toContain("xl:grid-cols-[minmax(0,1fr)_380px]");
    expect(notificationsPage).not.toContain("Active alerts");
    expect(notificationsPage).not.toContain("alerts in the current view");
    expect(notificationsPage).not.toContain('data-testid="selected-notification-detail-panel"');
    expect(notificationsPage).not.toContain('data-testid="selected-notification-detail"');
    expect(notificationsPage).not.toContain('data-testid="selected-notification-empty-detail"');
    expect(notificationsPage).not.toContain("Select an alert");
  });

  it("keeps filtering local and preserves a clear empty active-alert state", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("const filteredNotifications = notifications.filter(notification => {");
    expect(notificationsPage).toContain("return matchesSearch && matchesPriority && matchesClient && matchesDate;");
    expect(notificationsPage).not.toContain("const matchesRead =");
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

  it("does not render read-state header controls on the Notifications page", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).not.toContain("All notifications are read");
    expect(notificationsPage).not.toContain("unread notifications");
    expect(notificationsPage).not.toContain("button-mark-all-read");
    expect(notificationsPage).not.toContain("Mark All as Read");
    expect(notificationsPage).not.toContain("markAllAsReadMutation");
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
    expect(actionSection).toContain("setLocation(`${baseUrl.pathname}${baseUrl.search}${baseUrl.hash}`);");
    expect(actionSection).not.toContain("linkedin-analytics");
  });

  it("enriches performance-alert notification details from linked KPI and Benchmark rows", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('const enrichPerformanceAlertNotification = (n: any, row: any, itemType: "kpi" | "benchmark") => {');
    expect(routesFile).toContain('const notificationActionUrl = (row: any, itemType: "kpi" | "benchmark"): string => {');
    expect(routesFile).toContain('const tab = itemType === "benchmark" ? "benchmarks" : "kpis";');
    expect(routesFile).toContain('if (platform === "google_analytics") return `/campaigns/${campaignId}/ga4-metrics?tab=${tab}&highlight=${id}`;');
    expect(routesFile).toContain('if (!platform || platform === "campaign") return `/campaigns/${campaignId}?tab=${tab}&highlight=${id}#${tab}`;');
    expect(routesFile).toContain('const itemLabel = itemType === "benchmark" ? "Benchmark" : "KPI";');
    expect(routesFile).toContain("itemName: row?.name,");
    expect(routesFile).toContain("platformLabel,");
    expect(routesFile).toContain("actionUrl: notificationActionUrl(row, itemType),");
    expect(routesFile).toContain("currentValue: row?.currentValue,");
    expect(routesFile).toContain("thresholdValue: row?.alertThreshold,");
    expect(routesFile).toContain('alertCondition: row?.alertCondition || "below",');
  });

  it("renders KPI and Benchmark alert values and created date on notification cards", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("const metadata = getNotificationMetadata(notification);");
    expect(notificationsPage).toContain("Current value:");
    expect(notificationsPage).toContain("{formatAlertDetailValue(metadata?.currentValue)}");
    expect(notificationsPage).toContain("Threshold value:");
    expect(notificationsPage).toContain("{formatAlertThresholdValue(metadata)}");
    expect(notificationsPage).toContain("Created date:");
    expect(notificationsPage).toContain("{formatNotificationCreatedDate(notification.createdAt)}");
  });

  it("highlights campaign KPI and Benchmark cards opened from notification deep links", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain('import { useRoute, useSearch } from "wouter";');
    expect(campaignDetail).toContain('const highlightedKpiId = useMemo(() => new URLSearchParams(search).get("highlight") || "", [search]);');
    expect(campaignDetail).toContain('const el = document.getElementById(`campaign-kpi-${highlightedKpiId}`);');
    expect(campaignDetail).toContain('id={`campaign-kpi-${kpi.id}`}');
    expect(campaignDetail).toContain('const isHighlightedKpi = String(highlightedKpiId || "") === String(kpi.id || "");');
    expect(campaignDetail).toContain('const highlightedBenchmarkId = useMemo(() => new URLSearchParams(search).get("highlight") || "", [search]);');
    expect(campaignDetail).toContain('const el = document.getElementById(`campaign-benchmark-${highlightedBenchmarkId}`);');
    expect(campaignDetail).toContain('id={`campaign-benchmark-${benchmark.id}`}');
    expect(campaignDetail).toContain('const isHighlightedBenchmark = String(highlightedBenchmarkId || "") === String(benchmark.id || "");');
    expect(campaignDetail).toContain('window.scrollTo({ top, behavior: "smooth" });');
  });

  it("keeps KPI and Benchmark navigation without the removed selected-detail panel", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).not.toContain("const renderAlertDetail = (notification: Notification) => {");
    expect(notificationsPage).not.toContain('data-testid={`button-open-selected-alert-${notification.id}`}');
    expect(notificationsPage).not.toContain("Edit alert settings");
    expect(notificationsPage).toContain('data-testid={`button-view-alert-${notification.id}`}');
    expect(notificationsPage).toContain('metadata?.benchmarkId ? "View Benchmark" : "View KPI"');
    expect(notificationsPage).not.toContain('data-testid={`button-toggle-read-${notification.id}`}');
    expect(notificationsPage).not.toContain('data-testid={`button-delete-${notification.id}`}');
    expect(notificationsPage).not.toContain('aria-label="Dismiss notification"');
  });

  it("removes the visible read state filter without exposing history rows", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).not.toContain('<Label htmlFor="read-filter">Read state</Label>');
    expect(notificationsPage).not.toContain("All Read States");
    expect(notificationsPage).not.toContain('data-testid="select-read-filter"');
    expect(notificationsPage).toContain('className="grid grid-cols-1 md:grid-cols-3 gap-4"');
    expect(notificationsPage).not.toContain("readFilter");
    expect(notificationsPage).not.toContain("setReadFilter");
    expect(notificationsPage).not.toContain("matchesRead");
    expect(notificationsPage).not.toContain("setReadStateMutation");
    expect(notificationsPage).not.toContain('aria-label={notification.read ? "Mark as unread" : "Mark as read"}');
    expect(notificationsPage).not.toContain('<TooltipContent>{notification.read ? "Mark as unread" : "Mark as read"}</TooltipContent>');
    expect(notificationsPage).not.toContain('statusLabel: "Active",');
    expect(notificationsPage).not.toContain("Alert status");
    expect(notificationsPage).not.toContain('statusLabel: notification.read ? "Active, read" : "Active, unread"');
    expect(notificationsPage).not.toContain('<Label htmlFor="read-filter">Status</Label>');
    expect(notificationsPage).not.toContain('value="history"');
  });

  it("keeps row actions metadata-driven after removing platform detail helpers", () => {
    const notificationsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "notifications.tsx"),
      "utf-8"
    );

    expect(notificationsPage).toContain("if (metadata?.kpiId || metadata?.benchmarkId) {");
    expect(notificationsPage).toContain('const rawUrl = String(metadata?.actionUrl || "");');
    expect(notificationsPage).toContain('metadata?.benchmarkId ? "View Benchmark" : "View KPI"');
    expect(notificationsPage).not.toContain("const formatPlatformLabel = (value: unknown) => {");
    expect(notificationsPage).not.toContain("const getAlertItemType = (metadata: any, title: string) => {");
    expect(notificationsPage).not.toContain("platformLabel: formatPlatformLabel(metadata?.platformLabel || metadata?.platformType),");
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

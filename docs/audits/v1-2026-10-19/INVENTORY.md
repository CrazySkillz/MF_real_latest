# Current source inventory

Revision: `777aae6f6353e998d60b635d3e66b413093117c2`. Generated from tracked files by [inventory.cjs](inventory.cjs).

This is a declaration inventory, not a completeness or safety claim for semantic value paths. Every entry remains unverified unless the audit's trace record supplies evidence. Guard hints merely locate text. Conditional registrations and dynamic values need manual review.

Counts: 358 server route/middleware declarations; 37 React route declarations (including duplicates/public/fallback); 62 schema tables; 830 client fetch/query/mutation call sites; 64 scheduling/start/timer call sites; 319 test files; 10024 candidate value/label occurrences. Full call sites, tables, timer arguments and value candidates are in [inventory.json](inventory.json).

## Server declarations

| Method | Path | Location | Guard hints | Storage calls |
|---|---|---|---|---|
| USE | (req, res, next) =&gt; {   res.setHeader("X-Content-Type-Options", "nosniff");   res.setHeader("X-Frame-Options", "DENY");   res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");   res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");   if (app.get("env") === "production") {     res.setHeader("Content-Security-Policy", contentSecurityPolicy);     if (req.secure) {       res.setHeader("Strict-Transport-Security", "max-age=31536000");     }   }   next(); } | [server/index.ts:47](../../../server/index.ts#L47) | NONE in declaration |  |
| USE | clerkMiddleware() | [server/index.ts:68](../../../server/index.ts#L68) | NONE in declaration |  |
| USE | (req, res, next) =&gt; {   // Skip body parsing for Mailgun/SendGrid inbound webhooks (they use multer for multipart/form-data)   if (req.path === '/api/mailgun/inbound' \|\| req.path === '/api/sendgrid/inbound') {     return next();   }   // Apply body parsing for all other routes   express.json()(req, res, (err) =&gt; {     if (err) return next(err);     express.urlencoded({ extended: false })(req, res, next);   }); } | [server/index.ts:71](../../../server/index.ts#L71) | NONE in declaration |  |
| USE | '/api' | [server/index.ts:168](../../../server/index.ts#L168) | NONE in declaration |  |
| GET | '/health/scheduler' | [server/index.ts:215](../../../server/index.ts#L215) | NONE in declaration |  |
| USE | (err: any, _req: Request, res: Response, _next: NextFunction) =&gt; {       const status = err.status \|\| err.statusCode \|\| 500;       const message = err.message \|\| "Internal Server Error";       res.status(status).json({ message });       throw err;     } | [server/index.ts:235](../../../server/index.ts#L235) | NONE in declaration |  |
| GET | "/health" | [server/routes-oauth.ts:798](../../../server/routes-oauth.ts#L798) | NONE in declaration |  |
| GET | "/api/health" | [server/routes-oauth.ts:799](../../../server/routes-oauth.ts#L799) | NONE in declaration |  |
| GET | "/api/metrics" | [server/routes-oauth.ts:815](../../../server/routes-oauth.ts#L815) | NONE in declaration | getMetrics |
| POST | "/api/metrics" | [server/routes-oauth.ts:819](../../../server/routes-oauth.ts#L819) | NONE in declaration | createMetric |
| GET | "/api/performance" | [server/routes-oauth.ts:824](../../../server/routes-oauth.ts#L824) | NONE in declaration | getPerformanceData |
| POST | "/api/performance" | [server/routes-oauth.ts:828](../../../server/routes-oauth.ts#L828) | NONE in declaration | createPerformanceData |
| GET | "/api/integrations" | [server/routes-oauth.ts:833](../../../server/routes-oauth.ts#L833) | NONE in declaration | getIntegrations |
| POST | "/api/integrations" | [server/routes-oauth.ts:837](../../../server/routes-oauth.ts#L837) | NONE in declaration | createIntegration |
| GET | "/api/campaigns/:id/spend-sources" | [server/routes-oauth.ts:1535](../../../server/routes-oauth.ts#L1535) | requireCampaignAccessParamId | getSpendSources, getCampaign, getSpendBreakdownBySource |
| GET | "/api/campaigns/:id/ga4-overview/source-damage-inventory" | [server/routes-oauth.ts:1787](../../../server/routes-oauth.ts#L1787) | requireCampaignAccessParamId | getCampaign |
| GET | "/api/ga4-overview/retained-source-inventory" | [server/routes-oauth.ts:2233](../../../server/routes-oauth.ts#L2233) | getActorId | getCampaigns |
| GET | "/api/ga4-overview/shopify/source-damage-inventory" | [server/routes-oauth.ts:2326](../../../server/routes-oauth.ts#L2326) | getActorId | getCampaigns, getNotifications |
| POST | "/api/ga4-overview/shopify/disconnected-test-data/cleanup" | [server/routes-oauth.ts:2434](../../../server/routes-oauth.ts#L2434) | getActorId | getCampaigns, cleanupDisconnectedGa4ShopifyRevenue |
| GET | "/api/campaigns/:id/spend-sources/google-sheets-duplicates" | [server/routes-oauth.ts:2504](../../../server/routes-oauth.ts#L2504) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/spend-sources/google-sheets-duplicates/cleanup" | [server/routes-oauth.ts:2520](../../../server/routes-oauth.ts#L2520) | requireCampaignAccessParamId | deleteSpendRecordsBySource, deleteSpendSource |
| POST | "/api/campaigns/:id/spend-sources/google-sheets-duplicates/purge-inactive" | [server/routes-oauth.ts:2550](../../../server/routes-oauth.ts#L2550) | requireCampaignAccessParamId | getInactiveSpendSources, countSpendRecordsBySource, hardDeleteInactiveSpendSource |
| DELETE | "/api/campaigns/:id/spend-sources" | [server/routes-oauth.ts:2578](../../../server/routes-oauth.ts#L2578) | requireCampaignAccessParamId | getSpendSources, deleteSpendSource, deleteSpendRecordsBySource, updateCampaign |
| DELETE | '/api/campaigns/:id/ga4/google-sheets-spend/disconnect' | [server/routes-oauth.ts:2601](../../../server/routes-oauth.ts#L2601) | requireCampaignAccessParamId | disconnectGa4GoogleSheetsSpend |
| DELETE | '/api/campaigns/:id/ga4/google-ads-spend/disconnect' | [server/routes-oauth.ts:2616](../../../server/routes-oauth.ts#L2616) | requireCampaignAccessParamId | disconnectGa4GoogleAdsSpend |
| GET | "/api/campaigns/:id/spend-totals" | [server/routes-oauth.ts:2634](../../../server/routes-oauth.ts#L2634) | requireCampaignAccessParamId | getSpendSources, getSpendBreakdownBySource, getSpendTotalForRange |
| GET | "/api/campaigns/:id/spend-to-date" | [server/routes-oauth.ts:2688](../../../server/routes-oauth.ts#L2688) | requireCampaignAccessParamId | getCampaign, getSpendSources, getSpendTotalForRange |
| GET | "/api/campaigns/:id/daily-financials" | [server/routes-oauth.ts:2751](../../../server/routes-oauth.ts#L2751) | requireCampaignAccessParamId | getCampaign |
| GET | "/api/campaigns/:id/trend-analysis" | [server/routes-oauth.ts:2846](../../../server/routes-oauth.ts#L2846) | requireCampaignAccessParamId | getCampaign, getGA4Connections, getLinkedInConnection, getMetaConnection, getGoogleAdsConnection, getCustomIntegration, getGA4DailyMetrics, getLinkedInDailyMetrics, getMetaDailyMetrics, getGoogleAdsDailyMetrics, getRevenueTotalForRange |
| GET | "/api/campaigns/:id/revenue-to-date" | [server/routes-oauth.ts:3512](../../../server/routes-oauth.ts#L3512) | ensureCampaignAccess | getRevenueTotalForRange, getRevenueSources |
| GET | "/api/campaigns/:id/revenue-breakdown" | [server/routes-oauth.ts:3548](../../../server/routes-oauth.ts#L3548) | ensureCampaignAccess | getRevenueBreakdownBySource, getRevenueSources |
| GET | "/api/campaigns/:id/spend-breakdown" | [server/routes-oauth.ts:3578](../../../server/routes-oauth.ts#L3578) | ensureCampaignAccess | getSpendBreakdownBySource, getSpendSources |
| GET | "/api/campaigns/:id/spend-daily" | [server/routes-oauth.ts:3607](../../../server/routes-oauth.ts#L3607) | requireCampaignAccessParamId | getSpendSources, getSpendBreakdownBySource |
| GET | "/api/campaigns/:id/revenue-daily" | [server/routes-oauth.ts:3644](../../../server/routes-oauth.ts#L3644) | requireCampaignAccessParamId | getRevenueSources, getRevenueBreakdownBySource |
| GET | "/api/campaigns/:id/revenue-sources" | [server/routes-oauth.ts:3679](../../../server/routes-oauth.ts#L3679) | ensureCampaignAccess | getRevenueSources, getRevenueBreakdownBySource |
| GET | "/api/campaigns/:id/all-data-sources" | [server/routes-oauth.ts:3741](../../../server/routes-oauth.ts#L3741) | ensureCampaignAccess | getRevenueSources, getSpendSources, getHubspotConnection, getSalesforceConnection, getShopifyConnection |
| DELETE | "/api/campaigns/:id/linkedin/revenue-source" | [server/routes-oauth.ts:3801](../../../server/routes-oauth.ts#L3801) | ensureCampaignAccess | getRevenueSources, deleteRevenueSource, deleteRevenueRecordsBySource, getGoogleSheetsConnections, updateGoogleSheetsConnection, getHubspotConnection, updateHubspotConnection, updateLinkedInConnection, getCampaignLinkedInImportSessions, updateLinkedInImportSession, getPlatformKPIs, updateKPI |
| DELETE | "/api/campaigns/:id/revenue-sources" | [server/routes-oauth.ts:3904](../../../server/routes-oauth.ts#L3904) | ensureCampaignAccess | getRevenueSources, deleteRevenueSource, deleteRevenueRecordsBySource |
| DELETE | '/api/campaigns/:id/ga4/hubspot/disconnect' | [server/routes-oauth.ts:3928](../../../server/routes-oauth.ts#L3928) | ensureCampaignAccess | disconnectGa4HubspotRevenue |
| DELETE | '/api/campaigns/:id/ga4/shopify/disconnect' | [server/routes-oauth.ts:3952](../../../server/routes-oauth.ts#L3952) | ensureCampaignAccess | disconnectGa4ShopifyRevenue, getNotifications, updateNotification |
| DELETE | '/api/campaigns/:id/ga4/google-sheets/disconnect' | [server/routes-oauth.ts:3987](../../../server/routes-oauth.ts#L3987) | ensureCampaignAccess | disconnectGa4GoogleSheetsRevenue |
| DELETE | "/api/campaigns/:id/revenue-sources/:sourceId/pipeline-proxy" | [server/routes-oauth.ts:4009](../../../server/routes-oauth.ts#L4009) | ensureCampaignAccess | getRevenueSource, getSalesforceConnection, getHubspotConnection, disableGa4CrmPipelineProxy |
| DELETE | "/api/campaigns/:id/revenue-sources/:sourceId" | [server/routes-oauth.ts:4081](../../../server/routes-oauth.ts#L4081) | ensureCampaignAccess | getRevenueSource, deleteRevenueSourceWithRecords, getRevenueSources, getHubspotConnection, getSalesforceConnection, updateHubspotConnection, updateSalesforceConnection, getGoogleSheetsConnections, updateGoogleSheetsConnection, updateLinkedInConnection, getCampaignLinkedInImportSessions, updateLinkedInImportSession, getPlatformKPIs, updateKPI |
| DELETE | "/api/campaigns/:id/spend-sources/:sourceId" | [server/routes-oauth.ts:4223](../../../server/routes-oauth.ts#L4223) | ensureCampaignAccess | getSpendSources, deleteSpendSourceWithRecords, getGoogleSheetsConnections, deleteGoogleSheetsConnection |
| GET | "/api/campaigns/:id/revenue-totals" | [server/routes-oauth.ts:4277](../../../server/routes-oauth.ts#L4277) | ensureCampaignAccess | getRevenueTotalForRange |
| POST | "/api/campaigns/:id/revenue/process/manual" | [server/routes-oauth.ts:4540](../../../server/routes-oauth.ts#L4540) | ensureCampaignAccess | getRevenueSource, updateRevenueSource, deleteRevenueRecordsBySource, createRevenueSource, updateLinkedInConnection, createRevenueRecords |
| POST | "/api/campaigns/:id/revenue/csv/preview" | [server/routes-oauth.ts:4698](../../../server/routes-oauth.ts#L4698) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/revenue/csv/process" | [server/routes-oauth.ts:4735](../../../server/routes-oauth.ts#L4735) | requireCampaignAccessParamId | getRevenueSource, getCampaign, replaceGa4CsvRevenueSourceWithRecords, updateRevenueSource, deleteRevenueRecordsBySource, createRevenueSource, updateLinkedInConnection, createRevenueRecords |
| POST | "/api/campaigns/:id/revenue/sheets/preview" | [server/routes-oauth.ts:5277](../../../server/routes-oauth.ts#L5277) | ensureCampaignAccess | getGoogleSheetsConnections, updateGoogleSheetsConnection |
| POST | "/api/campaigns/:id/revenue/sheets/process" | [server/routes-oauth.ts:5442](../../../server/routes-oauth.ts#L5442) | ensureCampaignAccess | getRevenueSources, getGoogleSheetsConnections, updateGoogleSheetsConnection, getCampaign, replaceRevenueSourceWithRecords, createRevenueSource, updateRevenueSource, deleteRevenueRecordsBySource, updateLinkedInConnection, createRevenueRecords |
| POST | "/api/campaigns/:id/spend/process/manual" | [server/routes-oauth.ts:6010](../../../server/routes-oauth.ts#L6010) | ensureCampaignAccess | getSpendSources, getGA4GoogleAdsSpendConnection, getGoogleAdsConnection, getGA4GoogleAdsSpendDailyMetrics, getGoogleAdsDailyMetrics, getSpendSource, replaceSpendSourceWithRecords, updateSpendSource, deleteSpendRecordsBySource, createSpendSource, createSpendRecords |
| POST | "/api/campaigns/:id/spend/process/connectors" | [server/routes-oauth.ts:6223](../../../server/routes-oauth.ts#L6223) | NONE in declaration |  |
| POST | "/api/campaigns/:id/spend/process/ad-platforms" | [server/routes-oauth.ts:6225](../../../server/routes-oauth.ts#L6225) | NONE in declaration |  |
| POST | "/api/campaigns/:id/spend/linkedin/preview" | [server/routes-oauth.ts:6231](../../../server/routes-oauth.ts#L6231) | ensureCampaignAccess | getLinkedInConnection, getCampaign |
| POST | "/api/campaigns/:id/spend/linkedin/process" | [server/routes-oauth.ts:6298](../../../server/routes-oauth.ts#L6298) | ensureCampaignAccess | getLinkedInConnection, getCampaign, getSpendSource, deleteSpendRecordsBySource, updateSpendSource, getSpendSources, createSpendSource, createSpendRecords |
| POST | "/api/campaigns/:id/spend/meta/preview" | [server/routes-oauth.ts:6453](../../../server/routes-oauth.ts#L6453) | ensureCampaignAccess | getMetaConnection |
| POST | "/api/campaigns/:id/spend/csv/preview" | [server/routes-oauth.ts:6480](../../../server/routes-oauth.ts#L6480) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/spend/csv/process" | [server/routes-oauth.ts:6506](../../../server/routes-oauth.ts#L6506) | requireCampaignAccessParamId | getSpendSource, getCampaign, replaceCsvSpendSourceWithRecords |
| POST | "/api/campaigns/:id/spend/sheets/preview" | [server/routes-oauth.ts:6765](../../../server/routes-oauth.ts#L6765) | requireCampaignAccessParamId | getGoogleSheetsConnections, updateGoogleSheetsConnection |
| POST | "/api/campaigns/:id/spend/sheets/process" | [server/routes-oauth.ts:6905](../../../server/routes-oauth.ts#L6905) | requireCampaignAccessParamId | writeWithGA4RefreshOwnership, getSpendSources, getGoogleSheetsConnections, updateGoogleSheetsConnection, getCampaign, replaceSpendSourceWithRecords, createSpendSource, deleteSpendRecordsBySource, updateSpendSource, createSpendRecords |
| GET | "/api/notifications" | [server/routes-oauth.ts:7493](../../../server/routes-oauth.ts#L7493) | getActorId | getCampaigns, getNotifications, getKPI, getBenchmark |
| PATCH | "/api/notifications/mark-all-read" | [server/routes-oauth.ts:7608](../../../server/routes-oauth.ts#L7608) | getActorId |  |
| DELETE | "/api/notifications/all/clear" | [server/routes-oauth.ts:7646](../../../server/routes-oauth.ts#L7646) | getActorId |  |
| DELETE | "/api/notifications/:id" | [server/routes-oauth.ts:7689](../../../server/routes-oauth.ts#L7689) | getActorId, ensureCampaignAccess |  |
| PATCH | "/api/notifications/:id" | [server/routes-oauth.ts:7723](../../../server/routes-oauth.ts#L7723) | ensureCampaignAccess |  |
| POST | "/api/alerts/check" | [server/routes-oauth.ts:7756](../../../server/routes-oauth.ts#L7756) | NONE in declaration | getNotifications |
| GET | "/api/alerts/status" | [server/routes-oauth.ts:7806](../../../server/routes-oauth.ts#L7806) | NONE in declaration |  |
| GET | "/api/campaigns/:id/linkedin-daily" | [server/routes-oauth.ts:7840](../../../server/routes-oauth.ts#L7840) | ensureCampaignAccess | getLinkedInDailyMetrics |
| GET | "/api/linkedin/insights/:sessionId" | [server/routes-oauth.ts:7866](../../../server/routes-oauth.ts#L7866) | ensureLinkedInSessionAccess | getLinkedInImportSession, getLinkedInDailyMetrics, getCampaign, getLinkedInImportMetrics, getPlatformKPIs |
| GET | "/api/campaigns/:id/linkedin/coverage" | [server/routes-oauth.ts:8173](../../../server/routes-oauth.ts#L8173) | ensureCampaignAccess | getLinkedInConnection, getLinkedInDailyMetrics, getLatestLinkedInImportSession |
| POST | "/api/campaigns/:id/linkedin/refresh" | [server/routes-oauth.ts:8298](../../../server/routes-oauth.ts#L8298) | ensureCampaignAccess |  |
| POST | "/api/campaigns/:id/ga4/refresh" | [server/routes-oauth.ts:8320](../../../server/routes-oauth.ts#L8320) | ensureCampaignAccess |  |
| POST | "/api/campaigns/:id/linkedin-daily/mock" | [server/routes-oauth.ts:8338](../../../server/routes-oauth.ts#L8338) | NONE in declaration | upsertLinkedInDailyMetrics |
| POST | "/api/campaigns/:id/linkedin/mock-seed" | [server/routes-oauth.ts:8468](../../../server/routes-oauth.ts#L8468) | NONE in declaration | upsertLinkedInDailyMetrics, getCampaign, createLinkedInImportSession, createLinkedInImportMetric, createLinkedInAdPerformance |
| POST | "/api/alerts/test-email" | [server/routes-oauth.ts:8698](../../../server/routes-oauth.ts#L8698) | NONE in declaration |  |
| GET | "/api/industry-benchmarks" | [server/routes-oauth.ts:8753](../../../server/routes-oauth.ts#L8753) | NONE in declaration |  |
| GET | "/api/industry-benchmarks/:industry/:metric" | [server/routes-oauth.ts:8779](../../../server/routes-oauth.ts#L8779) | NONE in declaration |  |
| GET | "/api/clients" | [server/routes-oauth.ts:8936](../../../server/routes-oauth.ts#L8936) | getActorId | getClients |
| POST | "/api/clients" | [server/routes-oauth.ts:8949](../../../server/routes-oauth.ts#L8949) | getActorId | createClient |
| DELETE | "/api/clients/:id" | [server/routes-oauth.ts:8966](../../../server/routes-oauth.ts#L8966) | getActorId | deleteClientCascade |
| GET | "/api/campaigns" | [server/routes-oauth.ts:8983](../../../server/routes-oauth.ts#L8983) | getActorId | getClients, getCampaigns, getGA4InitialImportStatus |
| POST | "/api/campaigns" | [server/routes-oauth.ts:9037](../../../server/routes-oauth.ts#L9037) | getActorId | getClients, createCampaign |
| PATCH | "/api/campaigns/:id" | [server/routes-oauth.ts:9137](../../../server/routes-oauth.ts#L9137) | ensureCampaignAccess, getActorId | getGA4InitialImportStatus, getClients, getGA4Connections, requestGA4InitialImport, getCampaign, getGA4InitialImportWork, updateCampaignWithGA4DailyInvalidation, updateCampaign |
| GET | "/api/campaigns/:id" | [server/routes-oauth.ts:9245](../../../server/routes-oauth.ts#L9245) | ensureCampaignAccess | getGA4InitialImportStatus |
| DELETE | "/api/campaigns/:id" | [server/routes-oauth.ts:9261](../../../server/routes-oauth.ts#L9261) | ensureCampaignAccess | deleteCampaignCascade |
| POST | "/api/campaigns/:id/ga4-daily-scheduler/run-now" | [server/routes-oauth.ts:9288](../../../server/routes-oauth.ts#L9288) | ensureCampaignAccess |  |
| POST | "/api/campaigns/:id/ga4-notifications/reconcile" | [server/routes-oauth.ts:9319](../../../server/routes-oauth.ts#L9319) | ensureCampaignAccess | getPlatformKPIs, getPlatformBenchmarks, getGA4Connections, getLatestGA4DailyMetric |
| GET | "/api/campaigns/:id/ga4-daily" | [server/routes-oauth.ts:9350](../../../server/routes-oauth.ts#L9350) | ensureCampaignAccess | getGA4Connection, getGA4PublicationVersion, getExecutiveSummaryDailyComparisonData, getGA4DailyMetrics, getGA4Connections |
| GET | "/api/campaigns/:id/ga4-insights-trends-coverage" | [server/routes-oauth.ts:9627](../../../server/routes-oauth.ts#L9627) | ensureCampaignAccess | getGA4Connection, updateGA4ConnectionTokens, getGA4DailyMetrics |
| GET | "/api/campaigns/:id/ga4-to-date" | [server/routes-oauth.ts:9770](../../../server/routes-oauth.ts#L9770) | ensureCampaignAccess | getGA4Connection, getGA4DailyMetrics, getGA4OverviewSnapshot, updateGA4ConnectionTokens |
| GET | "/api/campaigns/:id/ga4-benchmark-provider-validation" | [server/routes-oauth.ts:10009](../../../server/routes-oauth.ts#L10009) | ensureCampaignAccess | getGA4Connection, getGA4Connections, getGA4DailyMetrics, updateGA4ConnectionTokens, getRevenueTotalForRange, getSpendTotalForRange, getSpendSources, getSpendBreakdownBySource, getPlatformBenchmarks |
| POST | "/api/seed-yesop-campaigns" | [server/routes-oauth.ts:10403](../../../server/routes-oauth.ts#L10403) | getActorId | getCampaign, updateCampaign, createCampaign, getGA4Connections, createGA4Connection, getSpendSources, createSpendSource, createSpendRecords, getRevenueSources, createRevenueSource, upsertGA4DailyMetrics |
| GET | "/api/campaigns/:id/ga4-metrics" | [server/routes-oauth.ts:10556](../../../server/routes-oauth.ts#L10556) | ensureCampaignAccess | getGA4Connection, getGA4Connections |
| GET | "/api/campaigns/:id/ga4-diagnostics" | [server/routes-oauth.ts:10695](../../../server/routes-oauth.ts#L10695) | ensureCampaignAccess | getGA4Connection, getGA4Connections |
| POST | "/api/auth/google/integrated-connect" | [server/routes-oauth.ts:10795](../../../server/routes-oauth.ts#L10795) | ensureCampaignAccess |  |
| GET | "/api/auth/google/simulation-auth" | [server/routes-oauth.ts:10821](../../../server/routes-oauth.ts#L10821) | NONE in declaration |  |
| POST | "/api/auth/google-sheets/connect" | [server/routes-oauth.ts:10885](../../../server/routes-oauth.ts#L10885) | requireCampaignAccessBodyCampaignId |  |
| GET | "/api/auth/google-sheets/callback" | [server/routes-oauth.ts:10932](../../../server/routes-oauth.ts#L10932) | verifying, verifyGA4OAuthState, getActorId, verifyGoogleSheetsOAuthState | getCampaign, getGA4Connections, createGA4Connection, setPrimaryGA4Connection, deleteGA4Connection, createGoogleSheetsConnection |
| POST | "/api/auth/hubspot/connect" | [server/routes-oauth.ts:11347](../../../server/routes-oauth.ts#L11347) | ensureCampaignAccess |  |
| POST | "/api/auth/salesforce/connect" | [server/routes-oauth.ts:11392](../../../server/routes-oauth.ts#L11392) | ensureCampaignAccess |  |
| POST | "/api/auth/shopify/connect" | [server/routes-oauth.ts:11445](../../../server/routes-oauth.ts#L11445) | ensureCampaignAccess |  |
| GET | "/api/auth/salesforce/callback" | [server/routes-oauth.ts:11506](../../../server/routes-oauth.ts#L11506) | ensureCampaignAccess | getSalesforceConnection, updateSalesforceConnection, createSalesforceConnection |
| GET | "/api/auth/shopify/callback" | [server/routes-oauth.ts:11725](../../../server/routes-oauth.ts#L11725) | NONE in declaration | withShopifyOauthStoreLock, replaceShopifyConnection |
| GET | "/api/auth/hubspot/callback" | [server/routes-oauth.ts:11922](../../../server/routes-oauth.ts#L11922) | verifyHubSpotOAuthState, ensureCampaignAccess | getHubspotConnection, updateHubspotConnection, createHubspotConnection |
| GET | "/api/google-sheets/:campaignId/spreadsheets" | [server/routes-oauth.ts:12097](../../../server/routes-oauth.ts#L12097) | requireCampaignAccessCampaignIdParam, ensureCampaignAccess | getGoogleSheetsConnections, updateGoogleSheetsConnection, getGoogleSheetsConnection |
| DELETE | "/api/google-sheets/:campaignId/connection" | [server/routes-oauth.ts:12257](../../../server/routes-oauth.ts#L12257) | requireCampaignAccessCampaignIdParam, ensureCampaignAccess | getGoogleSheetsConnections, deleteGoogleSheetsConnection, getHubspotConnections, getSalesforceConnections, getCampaign, updateCampaign, getLinkedInConnection, updateLinkedInConnection, getCampaignLinkedInImportSessions, updateLinkedInImportSession, getMetaConnection, updateMetaConnection |
| DELETE | "/api/hubspot/:campaignId/connection" | [server/routes-oauth.ts:12445](../../../server/routes-oauth.ts#L12445) | ensureCampaignAccess | getHubspotConnection, getHubspotConnections, deleteHubspotConnection, getGoogleSheetsConnections, getSalesforceConnections, getCampaign, updateCampaign, getLinkedInConnection, updateLinkedInConnection, getCampaignLinkedInImportSessions, updateLinkedInImportSession, getMetaConnection, updateMetaConnection |
| DELETE | "/api/salesforce/:campaignId/connection" | [server/routes-oauth.ts:12580](../../../server/routes-oauth.ts#L12580) | ensureCampaignAccess | getSalesforceConnection, getSalesforceConnections, deleteSalesforceConnection, getGoogleSheetsConnections, getHubspotConnections, getCampaign, updateCampaign, getLinkedInConnection, updateLinkedInConnection, getCampaignLinkedInImportSessions, updateLinkedInImportSession, getMetaConnection, updateMetaConnection |
| DELETE | "/api/shopify/:campaignId/connection" | [server/routes-oauth.ts:12713](../../../server/routes-oauth.ts#L12713) | ensureCampaignAccess | getShopifyConnection, getShopifyConnections, deleteShopifyConnection |
| POST | "/api/google-sheets/:campaignId/select-spreadsheet" | [server/routes-oauth.ts:12749](../../../server/routes-oauth.ts#L12749) | requireCampaignAccessCampaignIdParam, ensureCampaignAccess | getGoogleSheetsConnection, getGoogleSheetsConnections, updateGoogleSheetsConnection |
| GET | "/api/auth/google/callback" | [server/routes-oauth.ts:12794](../../../server/routes-oauth.ts#L12794) | verifyGA4OAuthState, ensureCampaignAccess |  |
| GET | "/api/campaigns/:id/ga4-connection-status" | [server/routes-oauth.ts:12891](../../../server/routes-oauth.ts#L12891) | ensureCampaignAccess | getGA4Connections |
| POST | "/api/campaigns/:id/ga4-property" | [server/routes-oauth.ts:13002](../../../server/routes-oauth.ts#L13002) | ensureCampaignAccess | getGA4Connections, updateGA4Connection, setPrimaryGA4Connection, createGA4Connection |
| GET | "/api/campaigns/:id/ga4-timeseries" | [server/routes-oauth.ts:13114](../../../server/routes-oauth.ts#L13114) | ensureCampaignAccess | getGA4Connection, getGA4Connections |
| GET | "/api/campaigns/:id/ga4-campaign-values" | [server/routes-oauth.ts:13223](../../../server/routes-oauth.ts#L13223) | ensureCampaignAccess | getCampaign |
| GET | "/api/campaigns/:id/ga4-landing-pages" | [server/routes-oauth.ts:13321](../../../server/routes-oauth.ts#L13321) | ensureCampaignAccess | getGA4Connection |
| GET | "/api/campaigns/:id/ga4-conversion-events" | [server/routes-oauth.ts:13458](../../../server/routes-oauth.ts#L13458) | ensureCampaignAccess | getGA4Connection |
| GET | "/api/campaigns/:id/ga4-breakdown" | [server/routes-oauth.ts:13592](../../../server/routes-oauth.ts#L13592) | ensureCampaignAccess | getGA4Connection |
| GET | '/api/campaigns/:id/ga4-geographic' | [server/routes-oauth.ts:13814](../../../server/routes-oauth.ts#L13814) | ensureCampaignAccess | getGA4Connection, getGA4Connections, updateGA4ConnectionTokens |
| POST | "/api/auth/google/url" | [server/routes-oauth.ts:14124](../../../server/routes-oauth.ts#L14124) | ensureCampaignAccess |  |
| POST | "/api/auth/google/callback" | [server/routes-oauth.ts:14173](../../../server/routes-oauth.ts#L14173) | verifyGA4OAuthState, ensureCampaignAccess |  |
| GET | "/api/ga4/check-connection/:campaignId" | [server/routes-oauth.ts:14297](../../../server/routes-oauth.ts#L14297) | ensureCampaignAccess | getGA4Connections |
| GET | "/api/campaigns/:id/connected-platforms" | [server/routes-oauth.ts:14381](../../../server/routes-oauth.ts#L14381) | ensureCampaignAccess | getGA4Connections, getGoogleSheetsConnections, getLinkedInConnection, getMetaConnection, getCustomIntegration, getGoogleAdsConnection, getInstagramConnection, getTikTokConnection, getHubspotConnection, getShopifyConnection, getSalesforceConnection, getLatestLinkedInImportSession |
| GET | "/api/campaigns/:id/linkedin-campaigns" | [server/routes-oauth.ts:14599](../../../server/routes-oauth.ts#L14599) | NONE in declaration | getLatestLinkedInImportSession, getLinkedInImportMetrics |
| GET | "/api/campaigns/:id/linkedin-campaign-revenue" | [server/routes-oauth.ts:14628](../../../server/routes-oauth.ts#L14628) | NONE in declaration | getRevenueTotalForRange, getHubspotConnection, getShopifyConnection, getSalesforceConnection |
| GET | "/api/campaigns/:id/google-ads-campaign-revenue" | [server/routes-oauth.ts:14692](../../../server/routes-oauth.ts#L14692) | requireCampaignAccessParamId | getRevenueSources |
| GET | "/api/campaigns/:id/meta-campaign-revenue" | [server/routes-oauth.ts:14807](../../../server/routes-oauth.ts#L14807) | requireCampaignAccessParamId | getRevenueSources |
| GET | "/api/campaigns/:id/outcome-totals" | [server/routes-oauth.ts:14926](../../../server/routes-oauth.ts#L14926) | requireCampaignAccessParamId, isInternalAutoRefreshRequest | getGA4PublicationVersion, getCampaign, getGA4Connections, getLinkedInConnection, getMetaConnection, getCustomIntegration, getGoogleSheetsConnections, getGA4DailyMetrics, getSpendTotalForRange, getSpendBreakdownBySource, getSpendSources, getRevenueTotalForRange, getRevenueBreakdownBySource, getRevenueSources, getMetaDailyMetrics, getLatestCustomIntegrationMetrics, getHubspotConnection, getSalesforceConnection, getShopifyConnection, getLatestFinancialDailySnapshot, upsertExecutiveSummaryDailySnapshot |
| GET | "/api/campaigns/:id/ga4-connections" | [server/routes-oauth.ts:16018](../../../server/routes-oauth.ts#L16018) | ensureCampaignAccess | getGA4Connections |
| PUT | "/api/campaigns/:id/ga4-connections/:connectionId/primary" | [server/routes-oauth.ts:16056](../../../server/routes-oauth.ts#L16056) | ensureCampaignAccess | setPrimaryGA4Connection |
| DELETE | "/api/ga4-connections/:connectionId" | [server/routes-oauth.ts:16075](../../../server/routes-oauth.ts#L16075) | getActorId, ensureCampaignAccess | deleteGA4Connection |
| GET | "/api/campaigns/:id/ga4-service-account/status" | [server/routes-oauth.ts:16101](../../../server/routes-oauth.ts#L16101) | ensureCampaignAccess |  |
| POST | "/api/campaigns/:id/ga4-service-account/connect" | [server/routes-oauth.ts:16111](../../../server/routes-oauth.ts#L16111) | ensureCampaignAccess | getGA4Connections, updateGA4Connection, createGA4Connection, setPrimaryGA4Connection |
| POST | "/api/ga4/select-property" | [server/routes-oauth.ts:16181](../../../server/routes-oauth.ts#L16181) | ensureCampaignAccess | getGA4Connections, updateGA4Connection, createGA4Connection |
| POST | "/api/auth/ga4/connect" | [server/routes-oauth.ts:16356](../../../server/routes-oauth.ts#L16356) | ensureCampaignAccess |  |
| POST | "/api/ga4/oauth-exchange" | [server/routes-oauth.ts:16398](../../../server/routes-oauth.ts#L16398) | ensureCampaignAccess | createGA4Connection |
| GET | "/api/campaigns/:id/google-sheets-service-account/status" | [server/routes-oauth.ts:16599](../../../server/routes-oauth.ts#L16599) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/google-sheets-service-account/connect" | [server/routes-oauth.ts:16607](../../../server/routes-oauth.ts#L16607) | requireCampaignAccessParamId, getActorId, verify | getCampaign, getGoogleSheetsConnections, createGoogleSheetsConnection |
| POST | "/api/google-sheets/oauth-exchange" | [server/routes-oauth.ts:16688](../../../server/routes-oauth.ts#L16688) | requireCampaignAccessBodyCampaignId, ensureCampaignAccess | getGoogleSheetsConnections, createGoogleSheetsConnection |
| GET | "/api/google-sheets/:spreadsheetId/sheets" | [server/routes-oauth.ts:16847](../../../server/routes-oauth.ts#L16847) | requireCampaignAccessQueryCampaignId, ensureCampaignAccess | getGoogleSheetsConnections, updateGoogleSheetsConnection |
| POST | "/api/google-sheets/select-spreadsheet" | [server/routes-oauth.ts:16939](../../../server/routes-oauth.ts#L16939) | requireCampaignAccessBodyCampaignId, ensureCampaignAccess | getGoogleSheetsConnection, getGoogleSheetsConnections, createGoogleSheetsConnection, updateGoogleSheetsConnection |
| POST | "/api/google-sheets/select-spreadsheet-multiple" | [server/routes-oauth.ts:17044](../../../server/routes-oauth.ts#L17044) | requireCampaignAccessBodyCampaignId, ensureCampaignAccess | getGoogleSheetsConnections, createGoogleSheetsConnection, updateGoogleSheetsConnection, deleteGoogleSheetsConnection |
| GET | "/api/campaigns/:id/google-sheets-connections" | [server/routes-oauth.ts:17364](../../../server/routes-oauth.ts#L17364) | requireCampaignAccessParamId | getCampaign, getGoogleSheetsConnections |
| GET | "/api/campaigns/:id/connected-data-sources" | [server/routes-oauth.ts:17470](../../../server/routes-oauth.ts#L17470) | requireCampaignAccessParamId | getCampaign, getGoogleSheetsConnections, deleteGoogleSheetsConnection, getHubspotConnections, getSalesforceConnections |
| GET | "/api/campaigns/:id/connected-data-sources/:sourceId/preview" | [server/routes-oauth.ts:17739](../../../server/routes-oauth.ts#L17739) | requireCampaignAccessParamId | getGoogleSheetsConnections, getGoogleSheetsConnection, getHubspotConnections, getSalesforceConnections |
| POST | "/api/campaigns/:id/google-sheets-connections/:connectionId/set-primary" | [server/routes-oauth.ts:18009](../../../server/routes-oauth.ts#L18009) | requireCampaignAccessParamId | setPrimaryGoogleSheetsConnection |
| GET | "/api/google-sheets/check-connection/:campaignId" | [server/routes-oauth.ts:18025](../../../server/routes-oauth.ts#L18025) | ensureCampaignAccess | getGoogleSheetsConnections |
| GET | "/api/hubspot/:campaignId/status" | [server/routes-oauth.ts:18058](../../../server/routes-oauth.ts#L18058) | ensureCampaignAccess | getHubspotConnection, updateHubspotConnection |
| GET | "/api/salesforce/:campaignId/connection" | [server/routes-oauth.ts:18130](../../../server/routes-oauth.ts#L18130) | ensureCampaignAccess | getSalesforceConnections |
| GET | "/api/salesforce/:campaignId/status" | [server/routes-oauth.ts:18171](../../../server/routes-oauth.ts#L18171) | ensureCampaignAccess | getSalesforceConnection |
| GET | "/api/salesforce/:campaignId/opportunities/fields" | [server/routes-oauth.ts:18251](../../../server/routes-oauth.ts#L18251) | ensureCampaignAccess |  |
| GET | "/api/salesforce/:campaignId/opportunities/stages" | [server/routes-oauth.ts:18303](../../../server/routes-oauth.ts#L18303) | ensureCampaignAccess |  |
| GET | "/api/salesforce/:campaignId/opportunities/unique-values" | [server/routes-oauth.ts:18322](../../../server/routes-oauth.ts#L18322) | ensureCampaignAccess |  |
| POST | "/api/salesforce/:campaignId/opportunities/preview" | [server/routes-oauth.ts:18460](../../../server/routes-oauth.ts#L18460) | ensureCampaignAccess | getCampaign |
| POST | "/api/campaigns/:id/salesforce/save-mappings" | [server/routes-oauth.ts:18670](../../../server/routes-oauth.ts#L18670) | requireCampaignAccessParamId, ensureCampaignAccess | writeWithGA4RefreshOwnership, getRevenueSource, getSalesforceConnection, getCampaign, getLatestLinkedInImportSession, updateLinkedInConnection, updateLinkedInImportSession, updateSalesforceConnection, createRevenueSource, deleteRevenueRecordsBySource, getLinkedInImportMetrics, updateRevenueSource, replaceGa4SalesforceRevenueSourceWithRecords, createRevenueRecords |
| GET | "/api/salesforce/:campaignId/pipeline-proxy" | [server/routes-oauth.ts:19328](../../../server/routes-oauth.ts#L19328) | ensureCampaignAccess | getSalesforceConnection, getCampaign, getRevenueSources, updateSalesforceConnection, updateRevenueSource |
| GET | "/api/hubspot/:campaignId/deals/properties" | [server/routes-oauth.ts:19631](../../../server/routes-oauth.ts#L19631) | ensureCampaignAccess |  |
| GET | "/api/hubspot/:campaignId/deals/pipelines" | [server/routes-oauth.ts:19673](../../../server/routes-oauth.ts#L19673) | ensureCampaignAccess |  |
| GET | "/api/hubspot/:campaignId/pipeline-proxy" | [server/routes-oauth.ts:19698](../../../server/routes-oauth.ts#L19698) | ensureCampaignAccess | getHubspotConnection, getCampaign, getRevenueSources, updateHubspotConnection, updateRevenueSource |
| DELETE | "/api/hubspot/:campaignId/pipeline-proxy" | [server/routes-oauth.ts:19897](../../../server/routes-oauth.ts#L19897) | ensureCampaignAccess | getHubspotConnection, updateHubspotConnection |
| GET | "/api/hubspot/:campaignId/deals/unique-values" | [server/routes-oauth.ts:19993](../../../server/routes-oauth.ts#L19993) | ensureCampaignAccess |  |
| POST | "/api/campaigns/:id/hubspot/save-mappings" | [server/routes-oauth.ts:20083](../../../server/routes-oauth.ts#L20083) | requireCampaignAccessParamId, ensureCampaignAccess | writeWithGA4RefreshOwnership, getRevenueSource, getCampaign, getHubspotConnection, updateHubspotConnection, getRevenueSources, replaceGa4HubspotRevenueSourceWithRecords, updateRevenueSource, createRevenueSource, deleteRevenueRecordsBySource, updateLinkedInConnection, createRevenueRecords |
| GET | "/api/campaigns/:id/google-sheets-data" | [server/routes-oauth.ts:21785](../../../server/routes-oauth.ts#L21785) | requireCampaignAccessParamId | getCampaign, getGoogleSheetsConnections, updateGoogleSheetsConnection, getLinkedInConnection, getMetaConnection, getGA4Connections, getGoogleAdsConnection, getLatestLinkedInImportSession, getLinkedInImportMetrics, updateLinkedInConnection, updateMetaConnection, updateCampaign, updateLinkedInImportSession |
| POST | "/api/campaigns/:id/google-sheets-refresh" | [server/routes-oauth.ts:23145](../../../server/routes-oauth.ts#L23145) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/revenue-sources/:sourceId/hubspot-refresh/run-now" | [server/routes-oauth.ts:23157](../../../server/routes-oauth.ts#L23157) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/revenue-sources/:sourceId/shopify-refresh/run-now" | [server/routes-oauth.ts:23187](../../../server/routes-oauth.ts#L23187) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/revenue-sources/:sourceId/google-sheets-refresh/run-now" | [server/routes-oauth.ts:23217](../../../server/routes-oauth.ts#L23217) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/spend-sources/:sourceId/google-sheets-refresh/run-now" | [server/routes-oauth.ts:23261](../../../server/routes-oauth.ts#L23261) | requireCampaignAccessParamId |  |
| GET | "/api/campaigns/:id/google-trends" | [server/routes-oauth.ts:23305](../../../server/routes-oauth.ts#L23305) | NONE in declaration | getCampaign |
| POST | "/api/auth/linkedin/connect" | [server/routes-oauth.ts:23460](../../../server/routes-oauth.ts#L23460) | ensureCampaignAccess |  |
| GET | "/api/auth/linkedin/callback" | [server/routes-oauth.ts:23517](../../../server/routes-oauth.ts#L23517) | verifyLinkedInOAuthState, ensureCampaignAccess | getLinkedInConnection, updateLinkedInConnection, createLinkedInConnection |
| POST | "/api/linkedin/ad-accounts" | [server/routes-oauth.ts:23735](../../../server/routes-oauth.ts#L23735) | ensureCampaignAccess | getLinkedInConnection |
| POST | "/api/linkedin/:campaignId/select-ad-account" | [server/routes-oauth.ts:23781](../../../server/routes-oauth.ts#L23781) | ensureCampaignAccess | getLinkedInConnection, updateLinkedInConnection, createLinkedInConnection |
| POST | "/api/linkedin/campaigns" | [server/routes-oauth.ts:23848](../../../server/routes-oauth.ts#L23848) | ensureCampaignAccess | getLinkedInConnection |
| DELETE | "/api/linkedin/:campaignId/connection" | [server/routes-oauth.ts:23918](../../../server/routes-oauth.ts#L23918) | ensureCampaignAccess | getLinkedInConnection, deleteLinkedInCampaignAnalytics, deleteLinkedInConnection |
| POST | "/api/auth/meta/connect" | [server/routes-oauth.ts:24016](../../../server/routes-oauth.ts#L24016) | ensureCampaignAccess |  |
| GET | "/api/auth/meta/callback" | [server/routes-oauth.ts:24073](../../../server/routes-oauth.ts#L24073) | verifyMetaOAuthState, ensureCampaignAccess | deleteMetaConnection, createMetaConnection |
| GET | "/api/campaigns/:campaignId/meta/connection" | [server/routes-oauth.ts:24345](../../../server/routes-oauth.ts#L24345) | ensureCampaignAccess | getMetaConnection |
| DELETE | "/api/campaigns/:campaignId/meta/connection" | [server/routes-oauth.ts:24383](../../../server/routes-oauth.ts#L24383) | ensureCampaignAccess | deleteMetaConnection |
| POST | "/api/kpis/test-alerts" | [server/routes-oauth.ts:24420](../../../server/routes-oauth.ts#L24420) | getActorId |  |
| POST | "/api/meta/:campaignId/connect-test" | [server/routes-oauth.ts:24438](../../../server/routes-oauth.ts#L24438) | ensureCampaignAccess | deleteMetaConnection, createMetaConnection |
| GET | "/api/meta/:campaignId/connection" | [server/routes-oauth.ts:24487](../../../server/routes-oauth.ts#L24487) | ensureCampaignAccess | getMetaConnection |
| DELETE | "/api/meta/:campaignId/connection" | [server/routes-oauth.ts:24513](../../../server/routes-oauth.ts#L24513) | ensureCampaignAccess | deleteMetaConnection |
| GET | "/api/instagram/:campaignId/connection" | [server/routes-oauth.ts:24536](../../../server/routes-oauth.ts#L24536) | ensureCampaignAccess | getInstagramConnection |
| POST | "/api/instagram/:campaignId/connect-test" | [server/routes-oauth.ts:24581](../../../server/routes-oauth.ts#L24581) | ensureCampaignAccess | deleteInstagramConnection, createInstagramConnection, upsertInstagramDailyMetrics, updateInstagramConnection |
| PATCH | "/api/instagram/:campaignId/selected-campaigns" | [server/routes-oauth.ts:24665](../../../server/routes-oauth.ts#L24665) | ensureCampaignAccess | getInstagramConnection, deleteInstagramDailyMetrics, deleteInstagramFinancialData, updateInstagramConnection |
| DELETE | "/api/instagram/:campaignId/connection" | [server/routes-oauth.ts:24724](../../../server/routes-oauth.ts#L24724) | ensureCampaignAccess | getInstagramConnection, deleteInstagramConnection |
| GET | "/api/instagram/:campaignId/campaigns" | [server/routes-oauth.ts:24755](../../../server/routes-oauth.ts#L24755) | ensureCampaignAccess | getInstagramConnection |
| GET | "/api/tiktok/:campaignId/connection" | [server/routes-oauth.ts:24803](../../../server/routes-oauth.ts#L24803) | ensureCampaignAccess | getTikTokConnection |
| POST | "/api/tiktok/:campaignId/connect-test" | [server/routes-oauth.ts:24851](../../../server/routes-oauth.ts#L24851) | ensureCampaignAccess | deleteTikTokConnection, createTikTokConnection |
| PATCH | "/api/tiktok/:campaignId/selected-campaigns" | [server/routes-oauth.ts:24908](../../../server/routes-oauth.ts#L24908) | ensureCampaignAccess | getTikTokConnection, deleteTikTokDailyMetrics, deleteTikTokFinancialData, updateTikTokConnection |
| DELETE | "/api/tiktok/:campaignId/connection" | [server/routes-oauth.ts:24970](../../../server/routes-oauth.ts#L24970) | ensureCampaignAccess | getTikTokConnection, deleteTikTokConnection |
| GET | "/api/tiktok/:campaignId/campaigns" | [server/routes-oauth.ts:25001](../../../server/routes-oauth.ts#L25001) | ensureCampaignAccess | getTikTokConnection |
| POST | "/api/tiktok/:campaignId/refresh-test" | [server/routes-oauth.ts:25061](../../../server/routes-oauth.ts#L25061) | ensureCampaignAccess | getTikTokConnection, upsertTikTokDailyMetrics, updateTikTokConnection |
| POST | "/api/tiktok/:campaignId/refresh" | [server/routes-oauth.ts:25147](../../../server/routes-oauth.ts#L25147) | ensureCampaignAccess | getTikTokConnection, updateTikTokConnection |
| GET | "/api/tiktok/:campaignId/daily-metrics" | [server/routes-oauth.ts:25180](../../../server/routes-oauth.ts#L25180) | ensureCampaignAccess | getTikTokConnection, getTikTokDailyMetrics, getRevenueTotalForRange |
| GET | "/api/instagram/:campaignId/overview-summary" | [server/routes-oauth.ts:25270](../../../server/routes-oauth.ts#L25270) | ensureCampaignAccess | getInstagramConnection, getInstagramDailyMetrics |
| GET | "/api/instagram/:campaignId/daily-metrics" | [server/routes-oauth.ts:25338](../../../server/routes-oauth.ts#L25338) | ensureCampaignAccess | getInstagramConnection, getInstagramDailyMetrics, upsertInstagramDailyMetrics, updateInstagramConnection |
| POST | "/api/meta/transfer-connection" | [server/routes-oauth.ts:25443](../../../server/routes-oauth.ts#L25443) | ensureCampaignAccess | getMetaConnection, createMetaConnection, deleteMetaConnection |
| POST | "/api/instagram/:campaignId/refresh-test" | [server/routes-oauth.ts:25485](../../../server/routes-oauth.ts#L25485) | ensureCampaignAccess | getInstagramConnection, upsertInstagramDailyMetrics, updateInstagramConnection |
| POST | "/api/instagram/:campaignId/refresh" | [server/routes-oauth.ts:25563](../../../server/routes-oauth.ts#L25563) | ensureCampaignAccess | getInstagramConnection, upsertInstagramDailyMetrics, updateInstagramConnection |
| GET | "/api/meta/:campaignId/analytics" | [server/routes-oauth.ts:25652](../../../server/routes-oauth.ts#L25652) | ensureCampaignAccess | getMetaConnection, getMetaDailyMetrics |
| GET | "/api/meta/:campaignId/summary" | [server/routes-oauth.ts:25963](../../../server/routes-oauth.ts#L25963) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/campaigns" | [server/routes-oauth.ts:26008](../../../server/routes-oauth.ts#L26008) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/insights/daily" | [server/routes-oauth.ts:26057](../../../server/routes-oauth.ts#L26057) | ensureCampaignAccess | getMetaConnection, getMetaDailyMetrics |
| GET | "/api/meta/:campaignId/demographics" | [server/routes-oauth.ts:26124](../../../server/routes-oauth.ts#L26124) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/geographics" | [server/routes-oauth.ts:26165](../../../server/routes-oauth.ts#L26165) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/placements" | [server/routes-oauth.ts:26206](../../../server/routes-oauth.ts#L26206) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/adsets" | [server/routes-oauth.ts:26247](../../../server/routes-oauth.ts#L26247) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/ads" | [server/routes-oauth.ts:26284](../../../server/routes-oauth.ts#L26284) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/ad-insights" | [server/routes-oauth.ts:26321](../../../server/routes-oauth.ts#L26321) | ensureCampaignAccess | getMetaConnection |
| POST | "/api/meta/:campaignId/refresh" | [server/routes-oauth.ts:26359](../../../server/routes-oauth.ts#L26359) | ensureCampaignAccess | getMetaConnection |
| GET | "/api/meta/:campaignId/verify-token" | [server/routes-oauth.ts:26401](../../../server/routes-oauth.ts#L26401) | verify, ensureCampaignAccess, verifyToken | getMetaConnection |
| GET | "/api/platforms/meta/kpis/:campaignId" | [server/routes-oauth.ts:26442](../../../server/routes-oauth.ts#L26442) | ensureCampaignAccess | getPlatformKPIs |
| POST | "/api/platforms/meta/kpis" | [server/routes-oauth.ts:26464](../../../server/routes-oauth.ts#L26464) | ensureCampaignAccess | createKPI |
| PATCH | "/api/platforms/meta/kpis/:kpiId" | [server/routes-oauth.ts:26509](../../../server/routes-oauth.ts#L26509) | ensureCampaignAccess | getKPI, updateKPI, getMetaKPIById, updateMetaKPI |
| DELETE | "/api/platforms/meta/kpis/:kpiId" | [server/routes-oauth.ts:26564](../../../server/routes-oauth.ts#L26564) | ensureCampaignAccess, getActorId | getKPI, deleteKPI, getNotifications, getMetaKPIById, deleteMetaKPI |
| GET | "/api/campaigns/:id/google-ads-service-account/status" | [server/routes-oauth.ts:26677](../../../server/routes-oauth.ts#L26677) | ensureCampaignAccess |  |
| POST | "/api/campaigns/:id/google-ads-service-account/connect" | [server/routes-oauth.ts:26687](../../../server/routes-oauth.ts#L26687) | ensureCampaignAccess | getGA4GoogleAdsSpendConnection, getSpendSources, replaceGA4GoogleAdsSpendConnection |
| POST | "/api/auth/google-ads/connect" | [server/routes-oauth.ts:26777](../../../server/routes-oauth.ts#L26777) | ensureCampaignAccess |  |
| GET | "/api/auth/google-ads/callback" | [server/routes-oauth.ts:26827](../../../server/routes-oauth.ts#L26827) | verifyGoogleAdsOAuthState, ensureCampaignAccess, getActorId |  |
| POST | "/api/google-ads/:campaignId/select-customer" | [server/routes-oauth.ts:26928](../../../server/routes-oauth.ts#L26928) | ensureCampaignAccess, getActorId | getSpendSources, getGA4GoogleAdsSpendConnection, getGoogleAdsConnection, replaceGA4GoogleAdsSpendConnection, replaceGoogleAdsConnection |
| POST | "/api/google-ads/:campaignId/connect-test" | [server/routes-oauth.ts:27022](../../../server/routes-oauth.ts#L27022) | ensureCampaignAccess | replaceGoogleAdsConnection |
| GET | "/api/google-ads/:campaignId/connection" | [server/routes-oauth.ts:27064](../../../server/routes-oauth.ts#L27064) | ensureCampaignAccess | getGA4GoogleAdsSpendConnection, getGoogleAdsConnection |
| DELETE | "/api/google-ads/:campaignId/connection" | [server/routes-oauth.ts:27089](../../../server/routes-oauth.ts#L27089) | ensureCampaignAccess | getGoogleAdsConnection, deleteGoogleAdsConnection |
| GET | "/api/google-ads/:campaignId/daily-metrics" | [server/routes-oauth.ts:27112](../../../server/routes-oauth.ts#L27112) | ensureCampaignAccess | getGA4GoogleAdsSpendConnection, getGoogleAdsConnection, getGA4GoogleAdsSpendDailyMetrics, getGoogleAdsDailyMetrics |
| POST | "/api/google-ads/:campaignId/refresh" | [server/routes-oauth.ts:27154](../../../server/routes-oauth.ts#L27154) | ensureCampaignAccess | getGA4GoogleAdsSpendConnection, getGoogleAdsConnection |
| GET | "/api/google-ads/:campaignId/campaigns" | [server/routes-oauth.ts:27178](../../../server/routes-oauth.ts#L27178) | ensureCampaignAccess | getGoogleAdsConnection, getGoogleAdsDailyMetrics, updateGoogleAdsConnection |
| PATCH | "/api/google-ads/:campaignId/selected-campaigns" | [server/routes-oauth.ts:27245](../../../server/routes-oauth.ts#L27245) | ensureCampaignAccess | getGoogleAdsConnection, updateGoogleAdsConnection |
| POST | "/api/google-ads/:campaignId/enrich-ga4-revenue" | [server/routes-oauth.ts:27285](../../../server/routes-oauth.ts#L27285) | ensureCampaignAccess | getGoogleAdsConnection |
| GET | "/api/meta/:campaignId/daily-metrics" | [server/routes-oauth.ts:27304](../../../server/routes-oauth.ts#L27304) | ensureCampaignAccess | getMetaConnection, getMetaDailyMetrics |
| POST | "/api/campaigns/:id/spend/ad-platform/import" | [server/routes-oauth.ts:27328](../../../server/routes-oauth.ts#L27328) | ensureCampaignAccess | getGoogleAdsDailyMetrics, getMetaDailyMetrics, getLinkedInDailyMetrics, getTikTokConnection, getTikTokDailyMetrics, getSpendSources, createSpendSource, deleteSpendRecordsBySource, createSpendRecords, getSpendTotalForRange, updateCampaign |
| GET | "/api/linkedin/:campaignId/daily-metrics" | [server/routes-oauth.ts:27449](../../../server/routes-oauth.ts#L27449) | ensureCampaignAccess | getLinkedInConnection, getLinkedInDailyMetrics |
| POST | "/api/meta/:campaignId/enrich-ga4-revenue" | [server/routes-oauth.ts:27469](../../../server/routes-oauth.ts#L27469) | ensureCampaignAccess | getMetaConnection |
| POST | "/api/linkedin/:campaignId/enrich-ga4-revenue" | [server/routes-oauth.ts:27488](../../../server/routes-oauth.ts#L27488) | ensureCampaignAccess | getLinkedInConnection |
| PATCH | "/api/meta/:campaignId/selected-campaigns" | [server/routes-oauth.ts:27507](../../../server/routes-oauth.ts#L27507) | ensureCampaignAccess | getMetaConnection, updateMetaConnection |
| GET | "/api/campaigns/:id/benchmarks/evaluated" | [server/routes-oauth.ts:27540](../../../server/routes-oauth.ts#L27540) | ensureCampaignAccess | getMetaBenchmarks |
| POST | "/api/campaigns/:id/benchmarks" | [server/routes-oauth.ts:27568](../../../server/routes-oauth.ts#L27568) | ensureCampaignAccess | createMetaBenchmark |
| PATCH | "/api/benchmarks/:benchmarkId" | [server/routes-oauth.ts:27599](../../../server/routes-oauth.ts#L27599) | ensureBenchmarkAccess, ensureCampaignAccess | getMetaBenchmarkById, updateBenchmark, getGA4PublicationVersion, updateMetaBenchmark |
| DELETE | "/api/benchmarks/:benchmarkId" | [server/routes-oauth.ts:27641](../../../server/routes-oauth.ts#L27641) | ensureCampaignAccess, getActorId | getMetaBenchmarkById, deleteMetaBenchmark, getNotifications |
| GET | "/api/meta/reports" | [server/routes-oauth.ts:27689](../../../server/routes-oauth.ts#L27689) | ensureCampaignAccess | getMetaReports |
| POST | "/api/meta/reports" | [server/routes-oauth.ts:27716](../../../server/routes-oauth.ts#L27716) | ensureCampaignAccess | createMetaReport |
| PATCH | "/api/meta/reports/:reportId" | [server/routes-oauth.ts:27739](../../../server/routes-oauth.ts#L27739) | ensureCampaignAccess | getMetaReportById, updateMetaReport |
| DELETE | "/api/meta/reports/:reportId" | [server/routes-oauth.ts:27770](../../../server/routes-oauth.ts#L27770) | ensureCampaignAccess | getMetaReportById, deleteMetaReport |
| POST | "/api/meta/reports/:reportId/send" | [server/routes-oauth.ts:27794](../../../server/routes-oauth.ts#L27794) | ensureCampaignAccess | getMetaReportById |
| GET | "/api/meta/reports/:reportId/preview" | [server/routes-oauth.ts:27819](../../../server/routes-oauth.ts#L27819) | ensureCampaignAccess | getMetaReportById |
| POST | "/api/meta/:campaignId/revenue/manual" | [server/routes-oauth.ts:27845](../../../server/routes-oauth.ts#L27845) | ensureCampaignAccess | upsertMetaDailyMetrics |
| POST | "/api/meta/:campaignId/revenue/csv" | [server/routes-oauth.ts:27907](../../../server/routes-oauth.ts#L27907) | ensureCampaignAccess |  |
| GET | "/api/meta/:campaignId/revenue/summary" | [server/routes-oauth.ts:27932](../../../server/routes-oauth.ts#L27932) | ensureCampaignAccess | getMetaDailyMetrics |
| POST | "/api/custom-integration/connect" | [server/routes-oauth.ts:27998](../../../server/routes-oauth.ts#L27998) | ensureCampaignAccess | getCustomIntegration, createCustomIntegration |
| GET | "/api/custom-integration-by-id/:id" | [server/routes-oauth.ts:28071](../../../server/routes-oauth.ts#L28071) | ensureCampaignAccess | getCustomIntegrationById |
| GET | "/api/custom-integration/:campaignId" | [server/routes-oauth.ts:28089](../../../server/routes-oauth.ts#L28089) | ensureCampaignAccess | getCustomIntegration, getLatestCustomIntegrationMetrics |
| GET | "/api/custom-integration/:campaignId/changes" | [server/routes-oauth.ts:28111](../../../server/routes-oauth.ts#L28111) | ensureCampaignAccess | getLatestCustomIntegrationMetrics |
| GET | "/api/custom-integration/:campaignId/metrics" | [server/routes-oauth.ts:28168](../../../server/routes-oauth.ts#L28168) | ensureCampaignAccess | getLatestCustomIntegrationMetrics |
| POST | "/api/custom-integration/:campaignId/upload-pdf" | [server/routes-oauth.ts:28187](../../../server/routes-oauth.ts#L28187) | requireCampaignAccessCampaignIdParam | getCustomIntegration, createCustomIntegration, createCustomIntegrationMetrics |
| POST | "/api/webhook/custom-integration/:token" | [server/routes-oauth.ts:28246](../../../server/routes-oauth.ts#L28246) | NONE in declaration | getCustomIntegrationByToken, createCustomIntegrationMetrics |
| POST | "/api/email/inbound/:token" | [server/routes-oauth.ts:28372](../../../server/routes-oauth.ts#L28372) | NONE in declaration | getCustomIntegrationByToken, getLatestCustomIntegrationMetrics, createCustomIntegrationMetrics |
| POST | "/api/linkedin/connect" | [server/routes-oauth.ts:28529](../../../server/routes-oauth.ts#L28529) | NONE in declaration | createLinkedInConnection |
| GET | "/api/linkedin/check-connection/:campaignId" | [server/routes-oauth.ts:28568](../../../server/routes-oauth.ts#L28568) | ensureCampaignAccess | getLinkedInConnection |
| DELETE | "/api/linkedin/disconnect/:campaignId" | [server/routes-oauth.ts:28596](../../../server/routes-oauth.ts#L28596) | ensureCampaignAccess | getLinkedInConnection, deleteLinkedInCampaignAnalytics, deleteLinkedInConnection |
| PATCH | "/api/linkedin/update/:campaignId" | [server/routes-oauth.ts:28633](../../../server/routes-oauth.ts#L28633) | ensureCampaignAccess | updateLinkedInConnection |
| GET | "/api/campaigns/:id/kpis" | [server/routes-oauth.ts:28713](../../../server/routes-oauth.ts#L28713) | ensureCampaignAccess | getCampaignKPIs |
| GET | "/api/kpis/:kpiId/latest-period" | [server/routes-oauth.ts:28728](../../../server/routes-oauth.ts#L28728) | ensureKpiAccess | getLatestKPIPeriod |
| GET | "/api/platforms/:platformType/kpis" | [server/routes-oauth.ts:28743](../../../server/routes-oauth.ts#L28743) | ensureCampaignAccess | getPlatformKPIs |
| POST | "/api/platforms/:platformType/kpis" | [server/routes-oauth.ts:28780](../../../server/routes-oauth.ts#L28780) | ensureCampaignAccess | createKPI, getKPI |
| PATCH | "/api/platforms/:platformType/kpis/:kpiId" | [server/routes-oauth.ts:28857](../../../server/routes-oauth.ts#L28857) | ensureKpiAccess | getCampaign, updateCanonicalGA4KPI, updateKPI, getKPI |
| DELETE | "/api/platforms/:platformType/kpis/:kpiId" | [server/routes-oauth.ts:28968](../../../server/routes-oauth.ts#L28968) | ensureKpiAccess, getActorId | deleteKPI |
| POST | "/api/campaigns/:id/kpis" | [server/routes-oauth.ts:28995](../../../server/routes-oauth.ts#L28995) | ensureCampaignAccess | createKPI |
| PATCH | "/api/campaigns/:id/kpis/:kpiId" | [server/routes-oauth.ts:29040](../../../server/routes-oauth.ts#L29040) | ensureKpiAccess, ensureCampaignAccess | updateKPI, getGA4PublicationVersion |
| DELETE | "/api/campaigns/:id/kpis/:kpiId" | [server/routes-oauth.ts:29115](../../../server/routes-oauth.ts#L29115) | ensureKpiAccess, ensureCampaignAccess, getActorId | deleteKPI |
| GET | "/api/campaigns/:id/benchmarks" | [server/routes-oauth.ts:29145](../../../server/routes-oauth.ts#L29145) | ensureCampaignAccess | getCampaignBenchmarks |
| GET | "/api/campaigns/:id/benchmarks/evaluated" | [server/routes-oauth.ts:29160](../../../server/routes-oauth.ts#L29160) | ensureCampaignAccess | getCampaignBenchmarks, getLinkedInImportSession, getLatestLinkedInImportSession, getLinkedInImportMetrics |
| POST | "/api/campaigns/:id/benchmarks" | [server/routes-oauth.ts:29378](../../../server/routes-oauth.ts#L29378) | ensureCampaignAccess | createBenchmark |
| PATCH | "/api/campaigns/:campaignId/benchmarks/:benchmarkId" | [server/routes-oauth.ts:29416](../../../server/routes-oauth.ts#L29416) | ensureBenchmarkAccess | updateBenchmark, getGA4PublicationVersion |
| DELETE | "/api/campaigns/:campaignId/benchmarks/:benchmarkId" | [server/routes-oauth.ts:29475](../../../server/routes-oauth.ts#L29475) | ensureBenchmarkAccess, getActorId | deleteBenchmark |
| GET | "/api/kpis/:id/analytics" | [server/routes-oauth.ts:29502](../../../server/routes-oauth.ts#L29502) | ensureKpiAccess | getKPIAnalytics, getCampaign, getGA4Connections |
| POST | "/api/kpis/:id/progress" | [server/routes-oauth.ts:29554](../../../server/routes-oauth.ts#L29554) | ensureKpiAccess | recordKPIProgress, getGA4PublicationVersion |
| GET | "/api/platforms/:platformType/benchmarks" | [server/routes-oauth.ts:29605](../../../server/routes-oauth.ts#L29605) | ensureCampaignAccess | getPlatformBenchmarks |
| POST | "/api/platforms/:platformType/benchmarks" | [server/routes-oauth.ts:29627](../../../server/routes-oauth.ts#L29627) | ensureCampaignAccess | createBenchmark, getBenchmark |
| PUT | "/api/platforms/:platformType/benchmarks/:benchmarkId" | [server/routes-oauth.ts:29690](../../../server/routes-oauth.ts#L29690) | ensureBenchmarkAccess | updateBenchmark, getGA4PublicationVersion, getBenchmark |
| DELETE | "/api/platforms/:platformType/benchmarks/:benchmarkId" | [server/routes-oauth.ts:29759](../../../server/routes-oauth.ts#L29759) | ensureBenchmarkAccess, getActorId | deleteBenchmark |
| POST | "/api/campaigns/:id/custom-report-pdf" | [server/routes-oauth.ts:29786](../../../server/routes-oauth.ts#L29786) | ensureCampaignAccess | getCampaign |
| GET | "/api/platforms/:platformType/reports" | [server/routes-oauth.ts:29854](../../../server/routes-oauth.ts#L29854) | ensureCampaignAccess | getPlatformReports |
| POST | "/api/platforms/:platformType/reports" | [server/routes-oauth.ts:29870](../../../server/routes-oauth.ts#L29870) | ensureCampaignAccess, verify | getPlatformReports, createCampaignDeepDivePlatformReport, createPlatformReport |
| PATCH | "/api/platforms/:platformType/reports/:reportId" | [server/routes-oauth.ts:30029](../../../server/routes-oauth.ts#L30029) | ensurePlatformReportAccess | updateCampaignDeepDivePlatformReport, updatePlatformReport |
| DELETE | "/api/platforms/:platformType/reports/:reportId" | [server/routes-oauth.ts:30163](../../../server/routes-oauth.ts#L30163) | ensurePlatformReportAccess | deletePlatformReport |
| POST | "/api/platforms/:platformType/reports/:reportId/send-test" | [server/routes-oauth.ts:30185](../../../server/routes-oauth.ts#L30185) | ensurePlatformReportAccess |  |
| GET | "/api/platforms/:platformType/reports/:reportId/send-events" | [server/routes-oauth.ts:30224](../../../server/routes-oauth.ts#L30224) | ensurePlatformReportAccess |  |
| GET | "/api/platforms/:platformType/reports/:reportId/snapshots" | [server/routes-oauth.ts:30292](../../../server/routes-oauth.ts#L30292) | ensurePlatformReportAccess |  |
| POST | "/api/platforms/:platformType/reports/:reportId/snapshots" | [server/routes-oauth.ts:30317](../../../server/routes-oauth.ts#L30317) | ensurePlatformReportAccess | getCampaign |
| GET | "/api/report-snapshots/:snapshotId" | [server/routes-oauth.ts:30404](../../../server/routes-oauth.ts#L30404) | getActorId, ensurePlatformReportAccess |  |
| GET | "/api/report-snapshots/:snapshotId/pdf" | [server/routes-oauth.ts:30437](../../../server/routes-oauth.ts#L30437) | getActorId, ensurePlatformReportAccess |  |
| GET | "/api/benchmarks/:id" | [server/routes-oauth.ts:30508](../../../server/routes-oauth.ts#L30508) | ensureBenchmarkAccess |  |
| POST | "/api/benchmarks" | [server/routes-oauth.ts:30521](../../../server/routes-oauth.ts#L30521) | ensureCampaignAccess | createBenchmark |
| PUT | "/api/benchmarks/:id" | [server/routes-oauth.ts:30559](../../../server/routes-oauth.ts#L30559) | ensureBenchmarkAccess | updateBenchmark, getGA4PublicationVersion |
| DELETE | "/api/benchmarks/:id" | [server/routes-oauth.ts:30606](../../../server/routes-oauth.ts#L30606) | ensureBenchmarkAccess, getActorId | deleteBenchmark |
| GET | "/api/benchmarks/:id/history" | [server/routes-oauth.ts:30626](../../../server/routes-oauth.ts#L30626) | ensureBenchmarkAccess | getBenchmarkHistory |
| GET | "/api/benchmarks/:id/alert-email-delivery-validation" | [server/routes-oauth.ts:30640](../../../server/routes-oauth.ts#L30640) | ensureBenchmarkAccess |  |
| POST | "/api/benchmarks/:id/history" | [server/routes-oauth.ts:30736](../../../server/routes-oauth.ts#L30736) | ensureBenchmarkAccess | recordBenchmarkHistory, getGA4PublicationVersion |
| GET | "/api/benchmarks/:id/analytics" | [server/routes-oauth.ts:30768](../../../server/routes-oauth.ts#L30768) | ensureBenchmarkAccess | getBenchmarkAnalytics, getCampaign, getGA4Connections |
| GET | '/api/attribution/models' | [server/routes-oauth.ts:30814](../../../server/routes-oauth.ts#L30814) | NONE in declaration |  |
| POST | '/api/attribution/models' | [server/routes-oauth.ts:30881](../../../server/routes-oauth.ts#L30881) | NONE in declaration | createAttributionModel |
| PATCH | '/api/attribution/models/:id' | [server/routes-oauth.ts:30896](../../../server/routes-oauth.ts#L30896) | NONE in declaration | updateAttributionModel |
| DELETE | '/api/attribution/models/:id' | [server/routes-oauth.ts:30915](../../../server/routes-oauth.ts#L30915) | NONE in declaration | deleteAttributionModel |
| POST | '/api/attribution/models/:id/set-default' | [server/routes-oauth.ts:30929](../../../server/routes-oauth.ts#L30929) | NONE in declaration | setDefaultAttributionModel |
| GET | '/api/attribution/journeys' | [server/routes-oauth.ts:30944](../../../server/routes-oauth.ts#L30944) | NONE in declaration |  |
| POST | '/api/attribution/journeys' | [server/routes-oauth.ts:31036](../../../server/routes-oauth.ts#L31036) | NONE in declaration | createCustomerJourney |
| PATCH | '/api/attribution/journeys/:id' | [server/routes-oauth.ts:31051](../../../server/routes-oauth.ts#L31051) | NONE in declaration | updateCustomerJourney |
| GET | '/api/attribution/journeys/:id' | [server/routes-oauth.ts:31070](../../../server/routes-oauth.ts#L31070) | NONE in declaration | getCustomerJourney |
| GET | '/api/attribution/touchpoints' | [server/routes-oauth.ts:31085](../../../server/routes-oauth.ts#L31085) | NONE in declaration |  |
| POST | '/api/attribution/touchpoints' | [server/routes-oauth.ts:31331](../../../server/routes-oauth.ts#L31331) | NONE in declaration | createTouchpoint |
| POST | '/api/attribution/calculate' | [server/routes-oauth.ts:31347](../../../server/routes-oauth.ts#L31347) | NONE in declaration | calculateAttributionResults |
| GET | '/api/attribution/channel-performance' | [server/routes-oauth.ts:31365](../../../server/routes-oauth.ts#L31365) | NONE in declaration |  |
| GET | '/api/campaigns/:campaignId/attribution' | [server/routes-oauth.ts:31437](../../../server/routes-oauth.ts#L31437) | NONE in declaration | getCampaignTouchpoints, getCampaignAttributionInsights |
| POST | "/api/linkedin/imports" | [server/routes-oauth.ts:31476](../../../server/routes-oauth.ts#L31476) | ensureCampaignAccess | createLinkedInImportSession, getLinkedInDailyMetrics, upsertLinkedInDailyMetrics, updateLinkedInConnection, createLinkedInImportMetric, createLinkedInAdPerformance, getLinkedInConnection, createLinkedInConnection |
| GET | "/api/linkedin/import-sessions/:campaignId" | [server/routes-oauth.ts:31830](../../../server/routes-oauth.ts#L31830) | ensureCampaignAccess | getLinkedInConnection, getCampaignLinkedInImportSessions |
| GET | "/api/linkedin/metrics/:campaignId" | [server/routes-oauth.ts:31847](../../../server/routes-oauth.ts#L31847) | ensureCampaignAccess | getLinkedInConnection, getLatestLinkedInImportSession, getLinkedInImportMetrics, getGoogleSheetsConnections, getHubspotConnections, getSalesforceConnections |
| POST | "/api/campaigns/:id/snapshots" | [server/routes-oauth.ts:32034](../../../server/routes-oauth.ts#L32034) | requireCampaignAccessParamId | createMetricSnapshot |
| GET | "/api/campaigns/:id/executive-summary/trajectory" | [server/routes-oauth.ts:32064](../../../server/routes-oauth.ts#L32064) | requireCampaignAccessParamId | getExecutiveSummaryDailyComparisonData, getRevenueSources |
| GET | "/api/campaigns/:id/financial-daily-snapshot" | [server/routes-oauth.ts:32100](../../../server/routes-oauth.ts#L32100) | requireCampaignAccessParamId | getLatestFinancialDailySnapshot |
| GET | "/api/campaigns/:id/snapshots/comparison" | [server/routes-oauth.ts:32118](../../../server/routes-oauth.ts#L32118) | requireCampaignAccessParamId | getFinancialDailyComparisonData, getComparisonData |
| GET | "/api/campaigns/:id/snapshots" | [server/routes-oauth.ts:32167](../../../server/routes-oauth.ts#L32167) | requireCampaignAccessParamId | getCampaignSnapshotsByPeriod |
| GET | "/api/snapshots/scheduler" | [server/routes-oauth.ts:32185](../../../server/routes-oauth.ts#L32185) | NONE in declaration |  |
| GET | "/api/linkedin/imports/:sessionId" | [server/routes-oauth.ts:32196](../../../server/routes-oauth.ts#L32196) | ensureLinkedInSessionAccess | getLinkedInImportSession, getCampaign, getLinkedInImportMetrics, getLinkedInAdPerformance, getCampaignBenchmarks |
| GET | "/api/linkedin/imports/:sessionId/ads" | [server/routes-oauth.ts:32526](../../../server/routes-oauth.ts#L32526) | ensureLinkedInSessionAccess | getLinkedInImportSession, getLinkedInAdPerformance, getCampaign, getLinkedInConnection |
| GET | "/api/linkedin/reports" | [server/routes-oauth.ts:32665](../../../server/routes-oauth.ts#L32665) | ensureCampaignAccess | getPlatformReports |
| GET | "/api/linkedin/reports/:id" | [server/routes-oauth.ts:32682](../../../server/routes-oauth.ts#L32682) | ensurePlatformReportAccess |  |
| POST | "/api/linkedin/reports" | [server/routes-oauth.ts:32699](../../../server/routes-oauth.ts#L32699) | ensureCampaignAccess | createLinkedInReport |
| PATCH | "/api/linkedin/reports/:id" | [server/routes-oauth.ts:32717](../../../server/routes-oauth.ts#L32717) | ensurePlatformReportAccess | updateLinkedInReport |
| PUT | "/api/linkedin/reports/:id" | [server/routes-oauth.ts:32745](../../../server/routes-oauth.ts#L32745) | ensurePlatformReportAccess | updateLinkedInReport |
| DELETE | "/api/linkedin/reports/:id" | [server/routes-oauth.ts:32773](../../../server/routes-oauth.ts#L32773) | ensurePlatformReportAccess | deleteLinkedInReport |
| GET | "/api/campaigns/:id/executive-summary" | [server/routes-oauth.ts:32795](../../../server/routes-oauth.ts#L32795) | ensureCampaignAccess | getMetaConnection, getMetaDailyMetrics, getRevenueTotalForRange, getGA4Connections, getGA4DailyMetrics, getLatestCustomIntegrationMetrics, getGoogleSheetsConnections, getSpendTotalForRange, getSpendBreakdownBySource, getRevenueBreakdownBySource, getRevenueSources, getPlatformKPIs, getCampaignKPIs, getPlatformBenchmarks, getCampaignBenchmarks, getComparisonData |
| POST | "/api/ga4/transfer-connection" | [server/routes-oauth.ts:33549](../../../server/routes-oauth.ts#L33549) | ensureCampaignAccess | getGA4Connections, createGA4Connection, setPrimaryGA4Connection, deleteGA4Connection |
| POST | "/api/google-sheets/transfer-connection" | [server/routes-oauth.ts:33626](../../../server/routes-oauth.ts#L33626) | ensureCampaignAccess | getGoogleSheetsConnection, createGoogleSheetsConnection, deleteGoogleSheetsConnection |
| POST | "/api/linkedin/transfer-connection" | [server/routes-oauth.ts:33667](../../../server/routes-oauth.ts#L33667) | ensureCampaignAccess | getLinkedInConnection, createLinkedInConnection, getCampaignLinkedInImportSessions, updateLinkedInImportSession, deleteLinkedInConnection |
| POST | "/api/custom-integration/:campaignId/connect" | [server/routes-oauth.ts:33729](../../../server/routes-oauth.ts#L33729) | ensureCampaignAccess | createCustomIntegration |
| DELETE | "/api/custom-integration/:campaignId" | [server/routes-oauth.ts:33786](../../../server/routes-oauth.ts#L33786) | ensureCampaignAccess | deleteCustomIntegration |
| POST | "/api/sendgrid/inbound" | [server/routes-oauth.ts:33809](../../../server/routes-oauth.ts#L33809) | NONE in declaration | getCustomIntegrationByEmail, createCustomIntegrationMetrics |
| POST | "/api/mailgun/inbound" | [server/routes-oauth.ts:33943](../../../server/routes-oauth.ts#L33943) | NONE in declaration | getCustomIntegrationByEmail, createCustomIntegrationMetrics |
| POST | "/api/custom-integration/transfer" | [server/routes-oauth.ts:34100](../../../server/routes-oauth.ts#L34100) | ensureCampaignAccess, verifyIntegration | getCustomIntegration, createCustomIntegration, getAllCustomIntegrationMetrics, createCustomIntegrationMetrics, deleteCustomIntegration |
| POST | "/api/webhook/conversion/:campaignId" | [server/routes-oauth.ts:34209](../../../server/routes-oauth.ts#L34209) | NONE in declaration | getCampaign, createConversionEvent, getConversionEvents, updateCampaign |
| GET | "/api/platforms/:platform/fields" | [server/routes-oauth.ts:34290](../../../server/routes-oauth.ts#L34290) | NONE in declaration | getLinkedInConnection, getGoogleSheetsConnections |
| GET | "/api/campaigns/:id/google-sheets/detect-columns" | [server/routes-oauth.ts:34410](../../../server/routes-oauth.ts#L34410) | requireCampaignAccessParamId | getGoogleSheetsConnections, getGoogleSheetsConnection, getPrimaryGoogleSheetsConnection |
| GET | "/api/campaigns/:id/google-sheets/unique-values" | [server/routes-oauth.ts:34627](../../../server/routes-oauth.ts#L34627) | requireCampaignAccessParamId | getGoogleSheetsConnections |
| POST | "/api/campaigns/:id/google-sheets/auto-map" | [server/routes-oauth.ts:34733](../../../server/routes-oauth.ts#L34733) | requireCampaignAccessParamId |  |
| POST | "/api/campaigns/:id/google-sheets/save-mappings" | [server/routes-oauth.ts:34765](../../../server/routes-oauth.ts#L34765) | ensureCampaignAccess, verifyCampaign | getGoogleSheetsConnections, getLinkedInConnection, updateGoogleSheetsConnection, getCampaign, getCampaignLinkedInImportSessions, getLatestLinkedInImportSession, getLinkedInImportMetrics, updateCampaign, updateLinkedInConnection, updateLinkedInImportSession |
| PATCH | "/api/google-sheets/:campaignId/connection/:connectionId/platforms" | [server/routes-oauth.ts:35338](../../../server/routes-oauth.ts#L35338) | ensureCampaignAccess | getGoogleSheetsConnections, updateGoogleSheetsConnection |
| GET | "/api/campaigns/:id/google-sheets/mappings" | [server/routes-oauth.ts:35371](../../../server/routes-oauth.ts#L35371) | ensureCampaignAccess | getGoogleSheetsConnections, getGoogleSheetsConnection, getPrimaryGoogleSheetsConnection |
| POST | "/api/shopify/connect" | [server/routes-oauth.ts:35831](../../../server/routes-oauth.ts#L35831) | ensureCampaignAccess | replaceShopifyConnection |
| GET | "/api/shopify/:campaignId/status" | [server/routes-oauth.ts:35885](../../../server/routes-oauth.ts#L35885) | ensureCampaignAccess | getShopifyConnection |
| GET | "/api/shopify/:campaignId/debug" | [server/routes-oauth.ts:35946](../../../server/routes-oauth.ts#L35946) | ensureCampaignAccess |  |
| GET | "/api/shopify/:campaignId/orders/preview" | [server/routes-oauth.ts:36042](../../../server/routes-oauth.ts#L36042) | ensureCampaignAccess |  |
| GET | "/api/shopify/:campaignId/orders/unique-values" | [server/routes-oauth.ts:36122](../../../server/routes-oauth.ts#L36122) | ensureCampaignAccess |  |
| POST | "/api/campaigns/:id/shopify/save-mappings" | [server/routes-oauth.ts:36224](../../../server/routes-oauth.ts#L36224) | requireCampaignAccessParamId, ensureCampaignAccess, isInternalAutoRefreshRequest | updateGa4ShopifyRevenueSourceRefreshState, writeWithGA4RefreshOwnership, getRevenueSource, getCampaign, getRevenueSources, getShopifyConnection, updateShopifyConnection, deleteRevenueSource, deleteRevenueRecordsBySource, updateRevenueSource, createRevenueSource, replaceGa4ShopifyRevenueSourceWithRecords, createRevenueRecords, getHubspotConnection, updateHubspotConnection |
| USE | vite.middlewares | [server/vite.ts:43](../../../server/vite.ts#L43) | NONE in declaration |  |
| USE | "*" | [server/vite.ts:44](../../../server/vite.ts#L44) | NONE in declaration |  |
| USE | express.static(distPath, {        maxAge: "1y",       etag: true,       lastModified: true,       // Important for deployments (e.g. Render): do NOT long-cache index.html.       // If index.html is cached for 1y, users can get stuck on an old asset manifest and never see new UI changes.       setHeaders: (res, filePath) =&gt; {         if (filePath.endsWith(path.sep + "index.html")) {           res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");           res.setHeader("Pragma", "no-cache");           res.setHeader("Expires", "0");         } else {           // For hashed assets we can safely cache aggressively.           // express.static will already apply maxAge; mark immutable for better CDN/browser behavior.           res.setHeader("Cache-Control", "public, max-age=31536000, immutable");         }       }     }) | [server/vite.ts:81](../../../server/vite.ts#L81) | NONE in declaration |  |
| USE | "*" | [server/vite.ts:102](../../../server/vite.ts#L102) | NONE in declaration |  |

## React route declarations

| Declaration | Location |
|---|---|
| &lt;Route path="/" component={HomePage} /&gt; | [client/src/App.tsx:137](../../../client/src/App.tsx#L137) |
| &lt;Route path="/welcome" component={HomePage} /&gt; | [client/src/App.tsx:138](../../../client/src/App.tsx#L138) |
| &lt;Route path="/dashboard" component={Dashboard} /&gt; | [client/src/App.tsx:139](../../../client/src/App.tsx#L139) |
| &lt;Route path="/clients" component={ClientsPage} /&gt; | [client/src/App.tsx:140](../../../client/src/App.tsx#L140) |
| &lt;Route path="/campaigns" component={Campaigns} /&gt; | [client/src/App.tsx:141](../../../client/src/App.tsx#L141) |
| &lt;Route path="/campaigns/:id" component={CampaignDetail} /&gt; | [client/src/App.tsx:142](../../../client/src/App.tsx#L142) |
| &lt;Route path="/campaigns/:id/performance" component={CampaignPerformance} /&gt; | [client/src/App.tsx:143](../../../client/src/App.tsx#L143) |
| &lt;Route path="/campaigns/:id/platform-comparison" component={PlatformComparison} /&gt; | [client/src/App.tsx:144](../../../client/src/App.tsx#L144) |
| &lt;Route path="/campaigns/:id/trend-analysis" component={TrendAnalysis} /&gt; | [client/src/App.tsx:145](../../../client/src/App.tsx#L145) |
| &lt;Route path="/campaigns/:id/executive-summary" component={ExecutiveSummary} /&gt; | [client/src/App.tsx:146](../../../client/src/App.tsx#L146) |
| &lt;Route path="/campaigns/:id/financial-analysis" component={FinancialAnalysis} /&gt; | [client/src/App.tsx:147](../../../client/src/App.tsx#L147) |
| &lt;Route path="/campaigns/:id/talk-to-your-data" component={TalkToYourData} /&gt; | [client/src/App.tsx:148](../../../client/src/App.tsx#L148) |
| &lt;Route path="/campaigns/:id/ga4-metrics" component={GA4Metrics} /&gt; | [client/src/App.tsx:149](../../../client/src/App.tsx#L149) |
| &lt;Route path="/campaigns/:id/google-sheets-data" component={GoogleSheetsData} /&gt; | [client/src/App.tsx:150](../../../client/src/App.tsx#L150) |
| &lt;Route path="/campaigns/:id/linkedin-analytics" component={LinkedInAnalytics} /&gt; | [client/src/App.tsx:151](../../../client/src/App.tsx#L151) |
| &lt;Route path="/campaigns/:id/meta-analytics" component={MetaAnalytics} /&gt; | [client/src/App.tsx:152](../../../client/src/App.tsx#L152) |
| &lt;Route path="/campaigns/:id/google-ads-analytics" component={GoogleAdsAnalytics} /&gt; | [client/src/App.tsx:153](../../../client/src/App.tsx#L153) |
| &lt;Route path="/campaigns/:id/instagram-analytics" component={InstagramAnalytics} /&gt; | [client/src/App.tsx:154](../../../client/src/App.tsx#L154) |
| &lt;Route path="/campaigns/:id/tiktok-analytics" component={TikTokAnalytics} /&gt; | [client/src/App.tsx:155](../../../client/src/App.tsx#L155) |
| &lt;Route path="/campaigns/:id/custom-integration-analytics" component={CustomIntegrationAnalytics} /&gt; | [client/src/App.tsx:156](../../../client/src/App.tsx#L156) |
| &lt;Route path="/integrations/:id/analytics" component={CustomIntegrationAnalytics} /&gt; | [client/src/App.tsx:157](../../../client/src/App.tsx#L157) |
| &lt;Route path="/campaigns/:id/kpis" component={KPIs} /&gt; | [client/src/App.tsx:158](../../../client/src/App.tsx#L158) |
| &lt;Route path="/platforms/:platformType/kpis" component={PlatformKPIs} /&gt; | [client/src/App.tsx:159](../../../client/src/App.tsx#L159) |
| &lt;Route path="/linkedin-analytics" component={LinkedInAnalytics} /&gt; | [client/src/App.tsx:160](../../../client/src/App.tsx#L160) |
| &lt;Route path="/audiences" component={Audiences} /&gt; | [client/src/App.tsx:161](../../../client/src/App.tsx#L161) |
| &lt;Route path="/reports" component={Reports} /&gt; | [client/src/App.tsx:162](../../../client/src/App.tsx#L162) |
| &lt;Route path="/notifications" component={Notifications} /&gt; | [client/src/App.tsx:163](../../../client/src/App.tsx#L163) |
| &lt;Route path="/auth/google/callback" component={GoogleAuthCallback} /&gt; | [client/src/App.tsx:164](../../../client/src/App.tsx#L164) |
| &lt;Route component={NotFound} /&gt; | [client/src/App.tsx:165](../../../client/src/App.tsx#L165) |
| &lt;Route path="/privacy" component={PrivacyPolicy} /&gt; | [client/src/App.tsx:194](../../../client/src/App.tsx#L194) |
| &lt;Route path="/sign-in" component={AuthPage} /&gt; | [client/src/App.tsx:195](../../../client/src/App.tsx#L195) |
| &lt;Route path="/sign-up" component={AuthPage} /&gt; | [client/src/App.tsx:196](../../../client/src/App.tsx#L196) |
| &lt;Route&gt; | [client/src/App.tsx:198](../../../client/src/App.tsx#L198) |
| &lt;Route path="/sign-in"&gt; | [client/src/App.tsx:207](../../../client/src/App.tsx#L207) |
| &lt;Route path="/sign-up"&gt; | [client/src/App.tsx:208](../../../client/src/App.tsx#L208) |
| &lt;Route path="/privacy" component={PrivacyPolicy} /&gt; | [client/src/App.tsx:209](../../../client/src/App.tsx#L209) |
| &lt;Route&gt; | [client/src/App.tsx:210](../../../client/src/App.tsx#L210) |

## Persistence inventory

| Table | Fields |
|---|---|
| "clients" | id, ownerId, name, createdAt |
| "campaigns" | id, ownerId, clientId, name, clientWebsite, label, budget, currency, conversionValue, ga4CampaignFilter, reportingTimeZone, type, platform, impressions, clicks, spend, status, industry, trendKeywords, startDate, endDate, pacingStartDate, pacingEndDate, createdAt |
| "metrics" | id, name, value, change, icon, date |
| "integrations" | id, platform, name, connected, credentials, lastSync, createdAt |
| "performance_data" | id, date, impressions, clicks, conversions |
| "ga4_connections" | id, campaignId, propertyId, accessToken, refreshToken, serviceAccountKey, method, propertyName, websiteUrl, displayName, isPrimary, isActive, clientId, clientSecret, importStartDate, encryptedTokens, lookbackDays, expiresAt, connectedAt, createdAt |
| "ga4_connection_lifecycle_events" | id, connectionId, subjectCampaignId, propertyId, action, actor, reason, changedAt |
| "ga4_refresh_work" | id, campaignId, dueAt, reportingDate, scopeHash, scope, status, leaseToken, leaseExpiresAt, startedAt, completedAt, attemptCount, nextAttemptAt, suppressAlerts, retryable, lastError, updatedAt |
| "ga4_daily_metrics" | id, campaignId, propertyId, date, users, sessions, engagedSessions, pageviews, conversions, revenue, engagementRate, revenueMetric, isSimulated, updatedAt, createdAt |
| "ga4_overview_snapshots" | id, campaignId, propertyId, windowStart, windowEnd, campaignBreakdown, landingPages, conversionEvents, updatedAt, createdAt |
| "spend_sources" | id, campaignId, sourceType, platformContext, displayName, currency, mappingConfig, isActive, connectedAt, createdAt |
| "spend_records" | id, campaignId, spendSourceId, date, spend, currency, sourceType, subCampaignUrn, createdAt |
| "revenue_sources" | id, campaignId, sourceType, platformContext, displayName, currency, mappingConfig, isActive, connectedAt, createdAt |
| "revenue_records" | id, campaignId, revenueSourceId, date, revenue, currency, externalId, sourceType, subCampaignUrn, createdAt |
| "notifications" | id, title, message, type, campaignId, campaignName, read, priority, metadata, createdAt |
| "email_alert_events" | id, kind, entityType, entityId, dedupeKey, campaignId, campaignName, to, subject, provider, success, deliveryStatus, providerResponseId, attemptCount, lastAttemptAt, nextAttemptAt, deliveredAt, failedAt, error, metadata, createdAt |
| "google_sheets_connections" | id, campaignId, spreadsheetId, spreadsheetName, sheetName, purpose, method, accessToken, refreshToken, clientId, clientSecret, encryptedTokens, expiresAt, isPrimary, isActive, columnMappings, platforms, cachedData, lastDataRefreshAt, connectedAt, createdAt |
| "hubspot_connections" | id, campaignId, portalId, portalName, accessToken, refreshToken, clientId, clientSecret, encryptedTokens, expiresAt, isActive, mappingConfig, connectedAt, createdAt |
| "salesforce_connections" | id, campaignId, orgId, orgName, instanceUrl, accessToken, refreshToken, clientId, clientSecret, encryptedTokens, expiresAt, isActive, mappingConfig, connectedAt, createdAt |
| "shopify_connections" | id, campaignId, shopDomain, shopName, accessToken, encryptedTokens, isActive, mappingConfig, connectedAt, createdAt |
| "mapping_templates" | id, name, description, platform, columnStructure, mappings, createdAt, lastUsedAt, usageCount, createdBy, isShared |
| "linkedin_connections" | id, campaignId, adAccountId, adAccountName, accessToken, refreshToken, clientId, clientSecret, method, encryptedTokens, conversionValue, campaignUtmMap, lastRefreshAt, spendOnly, expiresAt, connectedAt, createdAt |
| "meta_connections" | id, campaignId, adAccountId, adAccountName, accessToken, refreshToken, encryptedTokens, method, conversionValue, selectedCampaignIds, campaignUtmMap, spendOnly, expiresAt, connectedAt, createdAt |
| "instagram_connections" | id, campaignId, adAccountId, adAccountName, accessToken, refreshToken, encryptedTokens, method, selectedCampaignIds, campaignUtmMap, publisherPlatformFilter, sourceContractVersion, lastRefreshAt, spendOnly, expiresAt, connectedAt, createdAt |
| "tiktok_connections" | id, campaignId, advertiserId, advertiserName, accessToken, refreshToken, encryptedTokens, method, selectedCampaignIds, selectedCampaignMetadata, reportingDimensions, reportingMetrics, sourceContractVersion, lastRefreshAt, lastError, spendOnly, expiresAt, connectedAt, createdAt, updatedAt |
| "google_ads_connections" | id, campaignId, customerId, customerName, managerAccountId, accessToken, refreshToken, clientId, clientSecret, developerToken, encryptedTokens, method, conversionValue, selectedCampaignIds, campaignUtmMap, lastRefreshAt, spendOnly, expiresAt, connectedAt, createdAt |
| "google_ads_daily_metrics" | id, campaignId, googleCampaignId, googleCampaignName, date, impressions, clicks, spend, conversions, conversionValue, ctr, cpc, cpm, interactionRate, videoViews, searchImpressionShare, costPerConversion, conversionRate, ga4Revenue, ga4UtmName, importedAt |
| "meta_kpis" | id, campaignId, name, metricType, targetValue, currentValue, status, progress, startDate, endDate, frequency, alertEnabled, alertThreshold, createdAt, updatedAt |
| "meta_benchmarks" | id, campaignId, name, metricType, benchmarkValue, currentValue, industry, source, comparisonType, status, percentageDiff, createdAt, updatedAt |
| "meta_reports" | id, campaignId, name, template, frequency, schedule, recipients, format, includeCharts, includeDemographics, includeGeographics, includePlacements, dateRange, customStartDate, customEndDate, enabled, lastSent, nextScheduled, createdAt, updatedAt |
| "meta_daily_metrics" | id, campaignId, metaCampaignId, date, impressions, reach, clicks, spend, conversions, videoViews, postEngagement, linkClicks, ctr, cpc, cpm, cpp, frequency, costPerConversion, conversionRate, revenue, roas, metaCampaignName, ga4Revenue, ga4UtmName, importedAt |
| "instagram_daily_metrics" | id, campaignId, instagramCampaignId, instagramCampaignName, date, publisherPlatform, platformPosition, impressions, clicks, spend, conversions, videoViews, actions, ctr, cpc, cpm, costPerConversion, conversionRate, ga4Revenue, ga4UtmName, importedAt |
| "tiktok_daily_metrics" | id, campaignId, advertiserId, tiktokCampaignId, tiktokCampaignName, date, impressions, clicks, spend, currency, conversions, videoViews, engagements, ctr, cpc, cpm, costPerConversion, conversionRate, rawMetrics, metricAvailability, isEstimated, sourceContractVersion, isSimulated, lastSyncedAt, createdAt, updatedAt |
| "linkedin_import_sessions" | id, campaignId, adAccountId, adAccountName, selectedCampaignsCount, selectedMetricsCount, selectedMetricKeys, conversionValue, importedAt |
| "linkedin_import_metrics" | id, sessionId, campaignUrn, campaignName, campaignStatus, metricKey, metricValue, importedAt |
| "linkedin_daily_metrics" | id, campaignId, date, impressions, clicks, reach, engagements, conversions, leads, spend, videoViews, viralImpressions, linkedinCampaignId, linkedinCampaignName, ga4Revenue, ga4UtmName, updatedAt, createdAt |
| "linkedin_ad_performance" | id, sessionId, adId, adName, campaignUrn, campaignName, campaignSelectedMetrics, impressions, reach, clicks, engagements, spend, conversions, leads, videoViews, viralImpressions, ctr, cpc, cpm, cvr, cpa, cpl, er, roi, roas, revenue, conversionRate, importedAt |
| "custom_integrations" | id, campaignId, email, webhookToken, allowedEmailAddresses, connectedAt, createdAt |
| "conversion_events" | id, campaignId, conversionId, value, currency, conversionType, source, metadata, occurredAt, receivedAt, createdAt |
| "custom_integration_metrics" | id, campaignId, impressions, reach, clicks, engagements, spend, conversions, leads, videoViews, viralImpressions, users, sessions, pageviews, avgSessionDuration, pagesPerSession, bounceRate, organicSearchShare, directBrandedShare, emailShare, referralShare, paidShare, socialShare, emailsDelivered, openRate, clickThroughRate, clickToOpenRate, hardBounces, spamComplaints, listGrowth, pdfFileName, emailSubject, emailId, previousMetrics, previousUpdateAt, parserMetadata, uploadedAt |
| "kpis" | id, campaignId, platformType, category, name, metric, sourceType, metricKey, aggregationMethod, calculationConfig, targetValue, currentValue, lastComputedValue, unit, description, priority, status, timeframe, trackingPeriod, rollingAverage, targetDate, alertThreshold, alertCondition, alertsEnabled, emailNotifications, emailRecipients, slackNotifications, alertFrequency, lastAlertSent, applyTo, specificCampaignId, createdAt, updatedAt |
| "kpi_periods" | id, kpiId, periodStart, periodEnd, periodType, periodLabel, finalValue, targetValue, unit, targetAchieved, performancePercentage, performanceLevel, previousPeriodValue, changeAmount, changePercentage, trendDirection, notes, createdAt, updatedAt |
| "kpi_progress" | id, kpiId, value, rollingAverage7d, rollingAverage30d, trendDirection, recordedAt, notes |
| "kpi_alerts" | id, kpiId, alertType, severity, message, currentValue, targetValue, thresholdValue, isActive, acknowledgedAt, resolvedAt, emailSent, slackSent, createdAt, updatedAt |
| "benchmarks" | id, campaignId, platformType, category, name, metric, description, benchmarkValue, currentValue, unit, benchmarkType, competitorName, source, calculationConfig, industry, geoLocation, period, status, variance, confidenceLevel, applyTo, specificCampaignId, linkedInCampaignName, alertThreshold, alertCondition, alertsEnabled, emailNotifications, emailRecipients, alertFrequency, lastAlertSent, lastUpdated, createdAt, updatedAt |
| "benchmark_history" | id, benchmarkId, currentValue, benchmarkValue, variance, performanceRating, recordedAt, notes |
| "metric_snapshots" | id, campaignId, totalImpressions, totalEngagements, totalClicks, totalConversions, totalLeads, totalSpend, metrics, snapshotType, reportingDate, recordedAt, notes |
| "ga4_google_ads_spend_connections" | id, campaignId, customerId, customerName, managerAccountId, accessToken, refreshToken, clientId, clientSecret, developerToken, encryptedTokens, method, spendOnly, lastRefreshAt, expiresAt, connectedAt, createdAt |
| "ga4_google_ads_spend_daily_metrics" | id, campaignId, googleCampaignId, googleCampaignName, date, impressions, clicks, spend, importedAt |
| "ab_tests" | id, campaignId, name, description, hypothesis, objective, trafficSplit, status, startDate, endDate, minSampleSize, confidenceLevel, significance, winnerVariant, createdAt, updatedAt |
| "ab_test_variants" | id, testId, name, description, content, trafficPercentage, isControl, createdAt |
| "ab_test_results" | id, testId, variantId, impressions, clicks, conversions, revenue, conversionRate, clickThroughRate, revenuePerVisitor, costPerConversion, recordedAt, updatedAt |
| "ab_test_events" | id, testId, variantId, eventType, eventValue, userId, sessionId, metadata, occurredAt |
| "attribution_models" | id, name, type, description, configuration, isDefault, isActive, createdAt, updatedAt |
| "customer_journeys" | id, customerId, sessionId, deviceId, userId, journeyStart, journeyEnd, totalTouchpoints, conversionValue, conversionType, status, createdAt, updatedAt |
| "touchpoints" | id, journeyId, campaignId, channel, platform, medium, source, campaign, content, term, touchpointType, position, timestamp, deviceType, userAgent, ipAddress, referrer, landingPage, eventValue, metadata, createdAt |
| "attribution_results" | id, journeyId, attributionModelId, touchpointId, campaignId, channel, attributionCredit, attributedValue, calculatedAt, createdAt |
| "attribution_insights" | id, attributionModelId, campaignId, channel, period, startDate, endDate, totalAttributedValue, totalTouchpoints, totalConversions, averageAttributionCredit, conversionRate, costPerAttribution, returnOnAdSpend, assistedConversions, lastClickConversions, firstClickConversions, createdAt, updatedAt |
| "linkedin_reports" | id, campaignId, name, description, platformType, reportType, configuration, scheduleEnabled, scheduleFrequency, scheduleDayOfWeek, scheduleDayOfMonth, scheduleTime, scheduleTimeZone, quarterTiming, scheduleRecipients, lastSentAt, nextScheduledAt, status, createdAt, updatedAt |
| "report_snapshots" | id, reportId, campaignId, platformType, reportType, windowStart, windowEnd, snapshotJson, hasEstimated, generatedAt, createdAt |
| "report_send_events" | id, reportId, snapshotId, scheduledKey, timeZone, recipients, status, error, sentAt, createdAt |
| "kpi_reports" | id, campaignId, name, description, reportType, scheduleEnabled, scheduleFrequency, scheduleDayOfWeek, scheduleDayOfMonth, scheduleTime, scheduleRecipients, lastSentAt, nextScheduledAt, status, createdAt, updatedAt |

## Job/start/timer declarations

| Call | Location | Arguments (abbreviated) |
|---|---|---|
| setInterval | [server/alert-email-scheduler.ts:65](../../../server/alert-email-scheduler.ts#L65) | () =&gt; {     runAlertEmailReminderSchedulerOnce().catch((error: any) =&gt; {       console.warn("[Alert Email Scheduler] Reminder check failed:", error?.message \|\| error);     });   } / config.intervalMs |
| setTimeout | [server/auto-refresh-scheduler.ts:237](../../../server/auto-refresh-scheduler.ts#L237) | () =&gt; reject(new Error(`${label} timed out after ${timeoutMs}ms`)) / timeoutMs |
| setTimeout | [server/auto-refresh-scheduler.ts:1090](../../../server/auto-refresh-scheduler.ts#L1090) | resolve / 1000 |
| setInterval | [server/auto-refresh-scheduler.ts:1570](../../../server/auto-refresh-scheduler.ts#L1570) | runGoogleSheetsFinancialRefresh / googleSheetsSpendIntervalMs |
| setInterval | [server/auto-refresh-scheduler.ts:1578](../../../server/auto-refresh-scheduler.ts#L1578) | runSalesforcePipelineRefresh / salesforcePipelineIntervalMs |
| setTimeout | [server/auto-refresh-scheduler.ts:1585](../../../server/auto-refresh-scheduler.ts#L1585) | () =&gt; {       runDailyAutoRefreshOnce("scheduled")         .catch((e: any) =&gt; console.error("[Auto Refresh] Scheduled run failed:", e?.message \|\| e))         .finally(scheduleNe / msUntilNextRun |
| setTimeout | [server/executive-summary-snapshot-scheduler.ts:57](../../../server/executive-summary-snapshot-scheduler.ts#L57) | () =&gt; void captureExecutiveSummarySnapshots(baseUrl) / 60_000 |
| setInterval | [server/executive-summary-snapshot-scheduler.ts:58](../../../server/executive-summary-snapshot-scheduler.ts#L58) | () =&gt; void captureExecutiveSummarySnapshots(baseUrl) / DAY_MS |
| setTimeout | [server/ga4-daily-scheduler.ts:641](../../../server/ga4-daily-scheduler.ts#L641) | () =&gt; controller.abort(new Error("GA4_REFRESH_WORK_DEADLINE_EXCEEDED")) / 900_000 |
| setTimeout | [server/ga4-daily-scheduler.ts:658](../../../server/ga4-daily-scheduler.ts#L658) | () =&gt; {       renewal = checkOwnership().catch(error =&gt; { ownershipError = error; controller?.abort(error); }).finally(() =&gt; {         if (!closing && !ownershipError) scheduleHe / 30_000 |
| setTimeout | [server/ga4-daily-scheduler.ts:1051](../../../server/ga4-daily-scheduler.ts#L1051) | () =&gt; reject(new Error("GA4_REFRESH_STAGE_WAIT_TIMEOUT")) / maxWaitMs |
| setTimeout | [server/ga4-daily-scheduler.ts:1074](../../../server/ga4-daily-scheduler.ts#L1074) | resolve / 1000 |
| setTimeout | [server/ga4-daily-scheduler.ts:1285](../../../server/ga4-daily-scheduler.ts#L1285) | runScheduled / 60_000 |
| setTimeout | [server/ga4-daily-scheduler.ts:1292](../../../server/ga4-daily-scheduler.ts#L1292) | runScheduled / delayMs |
| setTimeout | [server/ga4-daily-scheduler.ts:1306](../../../server/ga4-daily-scheduler.ts#L1306) | recover / 60_000 |
| setTimeout | [server/ga4-daily-scheduler.ts:1310](../../../server/ga4-daily-scheduler.ts#L1310) | recover / 60_000 |
| setInterval | [server/google-ads-scheduler.ts:406](../../../server/google-ads-scheduler.ts#L406) | () =&gt; {     void refreshAllGoogleAdsMetrics().catch((error: any) =&gt; {       console.error("[Google Ads Scheduler] Scheduled refresh failed:", error?.message \|\| error);     });  / refreshIntervalMs |
| setTimeout | [server/google-sheets-token-scheduler.ts:201](../../../server/google-sheets-token-scheduler.ts#L201) | () =&gt; {     refreshAllGoogleSheetsTokens();          // Then schedule regular runs every 24 hours     (global as any).googleSheetsTokenSchedulerInterval = setInterval(() =&gt; {  / msUntilNextRun |
| setInterval | [server/google-sheets-token-scheduler.ts:205](../../../server/google-sheets-token-scheduler.ts#L205) | () =&gt; {       refreshAllGoogleSheetsTokens();     } / refreshIntervalMs |
| setTimeout | [server/index.ts:262](../../../server/index.ts#L262) | async () =&gt; {         try {           if (!db) {             log('No DATABASE_URL configured; skipping database migrations and schedulers.');             return;           }  / 5000 |
| snapshotScheduler.start | [server/index.ts:1205](../../../server/index.ts#L1205) |  |
| executiveSummarySnapshotScheduler.start | [server/index.ts:1211](../../../server/index.ts#L1211) | port |
| startKPIScheduler | [server/index.ts:1218](../../../server/index.ts#L1218) |  |
| startReportScheduler | [server/index.ts:1225](../../../server/index.ts#L1225) |  |
| startLinkedInScheduler | [server/index.ts:1232](../../../server/index.ts#L1232) |  |
| startMetaScheduler | [server/index.ts:1239](../../../server/index.ts#L1239) |  |
| startGoogleSheetsTokenScheduler | [server/index.ts:1246](../../../server/index.ts#L1246) |  |
| startDailyAutoRefreshScheduler | [server/index.ts:1253](../../../server/index.ts#L1253) |  |
| startGA4DailyScheduler | [server/index.ts:1260](../../../server/index.ts#L1260) | port |
| startGoogleAdsScheduler | [server/index.ts:1267](../../../server/index.ts#L1267) |  |
| startInstagramScheduler | [server/index.ts:1274](../../../server/index.ts#L1274) |  |
| startTikTokScheduler | [server/index.ts:1281](../../../server/index.ts#L1281) |  |
| startAlertEmailScheduler | [server/index.ts:1288](../../../server/index.ts#L1288) |  |
| setInterval | [server/instagram-scheduler.ts:111](../../../server/instagram-scheduler.ts#L111) | () =&gt; {     refreshAllInstagramMetrics();   } / refreshIntervalMs |
| setTimeout | [server/integrated-ga4-auth.ts:114](../../../server/integrated-ga4-auth.ts#L114) | resolve / 500 |
| setTimeout | [server/kpi-scheduler.ts:509](../../../server/kpi-scheduler.ts#L509) | () =&gt; runDailyKPIJobs() / 45000 |
| setTimeout | [server/kpi-scheduler.ts:519](../../../server/kpi-scheduler.ts#L519) | () =&gt; {     runDailyKPIJobs();          // Then run every 24 hours     setInterval(runDailyKPIJobs, 24 * 60 * 60 * 1000);   } / timeUntilMidnight |
| setInterval | [server/kpi-scheduler.ts:523](../../../server/kpi-scheduler.ts#L523) | runDailyKPIJobs / 24 * 60 * 60 * 1000 |
| setInterval | [server/linkedin-scheduler.ts:789](../../../server/linkedin-scheduler.ts#L789) | () =&gt; {     refreshAllLinkedInData();   } / refreshIntervalMs |
| setInterval | [server/meta-scheduler.ts:413](../../../server/meta-scheduler.ts#L413) | () =&gt; {     refreshAllMetaData();   } / refreshIntervalMs |
| setTimeout | [server/report-scheduler.ts:4148](../../../server/report-scheduler.ts#L4148) | resolve / delay |
| setTimeout | [server/report-scheduler.ts:4154](../../../server/report-scheduler.ts#L4154) | resolve / delay |
| setTimeout | [server/report-scheduler.ts:4590](../../../server/report-scheduler.ts#L4590) | resolve / 1000 |
| cron.schedule | [server/report-scheduler.ts:4820](../../../server/report-scheduler.ts#L4820) | cronSchedule / () =&gt; {     void checkScheduledReports();   } / {     timezone: 'UTC', // Cron runs in UTC, per-report timezones handled in isReportDueNow   } |
| setTimeout | [server/routes-oauth.ts:3138](../../../server/routes-oauth.ts#L3138) | () =&gt; controller.abort() / timeoutMs |
| setTimeout | [server/routes-oauth.ts:4489](../../../server/routes-oauth.ts#L4489) | () =&gt; resolve(false) / GA4_REVENUE_RECOMPUTE_RESPONSE_WAIT_MS |
| setTimeout | [server/routes-oauth.ts:20792](../../../server/routes-oauth.ts#L20792) | () =&gt; controller.abort() / timeoutMs |
| setTimeout | [server/routes-oauth.ts:20811](../../../server/routes-oauth.ts#L20811) | () =&gt; reject(new Error('Token refresh timeout: OAuth API did not respond within 15 seconds')) / timeoutMs |
| setTimeout | [server/routes-oauth.ts:20849](../../../server/routes-oauth.ts#L20849) | resolve / retryDelay |
| setTimeout | [server/routes-oauth.ts:21938](../../../server/routes-oauth.ts#L21938) | () =&gt; controller.abort() / timeoutMs |
| setTimeout | [server/routes-oauth.ts:21957](../../../server/routes-oauth.ts#L21957) | () =&gt; reject(new Error('Request timeout: Google Sheets API did not respond within 30 seconds')) / timeoutMs |
| setTimeout | [server/routes-oauth.ts:22007](../../../server/routes-oauth.ts#L22007) | () =&gt; controller.abort() / timeoutMs |
| setTimeout | [server/routes-oauth.ts:22026](../../../server/routes-oauth.ts#L22026) | () =&gt; reject(new Error('Request timeout: Google Sheets API did not respond within 30 seconds')) / timeoutMs |
| setTimeout | [server/scheduler.ts:891](../../../server/scheduler.ts#L891) | () =&gt; createSnapshotsForAllCampaigns() / 30000 |
| setInterval | [server/scheduler.ts:894](../../../server/scheduler.ts#L894) | () =&gt; {       createSnapshotsForAllCampaigns();     } / interval |
| this.start | [server/scheduler.ts:911](../../../server/scheduler.ts#L911) |  |
| setTimeout | [server/services/meta-graph-api.ts:183](../../../server/services/meta-graph-api.ts#L183) | resolve / this.rateLimitDelay |
| setTimeout | [server/services/meta-graph-api.ts:616](../../../server/services/meta-graph-api.ts#L616) | resolve / 1000 |
| setTimeout | [server/storage.ts:1189](../../../server/storage.ts#L1189) | () =&gt; { expired = true; reject(new Error("GA4_REFRESH_DATABASE_WAIT_TIMEOUT")); } / 10_000 |
| setTimeout | [server/storage.ts:1202](../../../server/storage.ts#L1202) | () =&gt; connectionError!(new Error("GA4_REFRESH_DATABASE_TRANSACTION_TIMEOUT")) / 120_000 |
| setInterval | [server/tiktok-scheduler.ts:141](../../../server/tiktok-scheduler.ts#L141) | () =&gt; {     refreshAllTikTokMetrics();   } / refreshIntervalMs |
| setTimeout | [server/utils/mailgun-delivery.ts:42](../../../server/utils/mailgun-delivery.ts#L42) | resolve / ms |
| setTimeout | [server/utils/retry.ts:49](../../../server/utils/retry.ts#L49) | () =&gt; { signal?.removeEventListener("abort", abort); resolve(); } / ms |
| setTimeout | [server/utils/shopify-provider.ts:234](../../../server/utils/shopify-provider.ts#L234) | resolve / ms |

## Configuration names

Names only; no environment values collected. Indirect/config-file settings require the operations record.

| Name | Code references |
|---|---|
| ALERT_EMAIL_REMINDER_INTERVAL_MS | [server/alert-email-scheduler.ts:26](../../../server/alert-email-scheduler.ts#L26) |
| ALERT_EMAIL_REMINDER_SCHEDULER_ENABLED | [server/alert-email-scheduler.ts:24](../../../server/alert-email-scheduler.ts#L24) |
| ALLOW_MOCK_DATA | [server/routes-oauth.ts:8341](../../../server/routes-oauth.ts#L8341), [server/routes-oauth.ts:8471](../../../server/routes-oauth.ts#L8471) |
| APP_BASE_URL | [server/real-ga4-client.ts:47](../../../server/real-ga4-client.ts#L47), [server/routes-oauth.ts:7295](../../../server/routes-oauth.ts#L7295), [server/routes-oauth.ts:10900](../../../server/routes-oauth.ts#L10900), [server/routes-oauth.ts:11000](../../../server/routes-oauth.ts#L11000), [server/routes-oauth.ts:11200](../../../server/routes-oauth.ts#L11200), [server/routes-oauth.ts:11359](../../../server/routes-oauth.ts#L11359), [server/routes-oauth.ts:11400](../../../server/routes-oauth.ts#L11400), [server/routes-oauth.ts:11562](../../../server/routes-oauth.ts#L11562), [server/routes-oauth.ts:11987](../../../server/routes-oauth.ts#L11987), [server/routes-oauth.ts:16372](../../../server/routes-oauth.ts#L16372), [server/routes-oauth.ts:23486](../../../server/routes-oauth.ts#L23486), [server/routes-oauth.ts:23614](../../../server/routes-oauth.ts#L23614), [server/routes-oauth.ts:24042](../../../server/routes-oauth.ts#L24042), [server/routes-oauth.ts:24170](../../../server/routes-oauth.ts#L24170), [server/routes-oauth.ts:26799](../../../server/routes-oauth.ts#L26799), [server/routes-oauth.ts:26864](../../../server/routes-oauth.ts#L26864) |
| APP_SECRET | [server/routes-oauth.ts:11301](../../../server/routes-oauth.ts#L11301), [server/routes-oauth.ts:23408](../../../server/routes-oauth.ts#L23408), [server/routes-oauth.ts:23428](../../../server/routes-oauth.ts#L23428), [server/routes-oauth.ts:23957](../../../server/routes-oauth.ts#L23957), [server/routes-oauth.ts:23977](../../../server/routes-oauth.ts#L23977), [server/routes-oauth.ts:26644](../../../server/routes-oauth.ts#L26644), [server/utils/tokenVault.ts:32](../../../server/utils/tokenVault.ts#L32) |
| AUTO_REFRESH_DAILY_HOUR | [server/auto-refresh-scheduler.ts:93](../../../server/auto-refresh-scheduler.ts#L93) |
| AUTO_REFRESH_DAILY_MINUTE | [server/auto-refresh-scheduler.ts:94](../../../server/auto-refresh-scheduler.ts#L94) |
| AUTO_REFRESH_ENABLED | [server/auto-refresh-scheduler.ts:91](../../../server/auto-refresh-scheduler.ts#L91) |
| AUTO_REFRESH_INTERNAL_TIMEOUT_MS | [server/auto-refresh-scheduler.ts:188](../../../server/auto-refresh-scheduler.ts#L188) |
| AUTO_REFRESH_LINKEDIN_TIMEOUT_MS | [server/auto-refresh-scheduler.ts:1097](../../../server/auto-refresh-scheduler.ts#L1097) |
| AUTO_REFRESH_RUN_ON_STARTUP | [server/auto-refresh-scheduler.ts:95](../../../server/auto-refresh-scheduler.ts#L95) |
| AUTO_REFRESH_TIME_ZONE | [server/auto-refresh-scheduler.ts:92](../../../server/auto-refresh-scheduler.ts#L92) |
| CLERK_PUBLISHABLE_KEY | [server/index.ts:65](../../../server/index.ts#L65), [server/index.ts:66](../../../server/index.ts#L66) |
| COMMIT_SHA | [server/routes-oauth.ts:804](../../../server/routes-oauth.ts#L804) |
| DATABASE_URL | [server/db.ts:5](../../../server/db.ts#L5), [server/test-support/ga4-recovery-process-worker.ts:7](../../../server/test-support/ga4-recovery-process-worker.ts#L7), [server/test-support/ga4-recovery-process-worker.ts:10](../../../server/test-support/ga4-recovery-process-worker.ts#L10) |
| DEV | [client/src/components/LinkedInConnectionFlow.tsx:201](../../../client/src/components/LinkedInConnectionFlow.tsx#L201), [client/src/components/LinkedInUiStates.tsx:111](../../../client/src/components/LinkedInUiStates.tsx#L111), [client/src/pages/campaign-detail.tsx:79](../../../client/src/pages/campaign-detail.tsx#L79), [client/src/pages/campaign-detail.tsx:86](../../../client/src/pages/campaign-detail.tsx#L86), [client/src/pages/linkedin-analytics.tsx:108](../../../client/src/pages/linkedin-analytics.tsx#L108) |
| EMAIL_DOMAIN | [server/utils/email-generator.ts:20](../../../server/utils/email-generator.ts#L20), [server/utils/email-generator.ts:30](../../../server/utils/email-generator.ts#L30) |
| EMAIL_FROM_ADDRESS | [server/services/alert-monitoring.ts:111](../../../server/services/alert-monitoring.ts#L111), [server/services/email-service.ts:108](../../../server/services/email-service.ts#L108) |
| EMAIL_PROVIDER | [server/report-scheduler.ts:4624](../../../server/report-scheduler.ts#L4624), [server/services/email-service.ts:104](../../../server/services/email-service.ts#L104) |
| EMAIL_SERVICE_API_KEY | [server/routes-oauth.ts:7829](../../../server/routes-oauth.ts#L7829), [server/routes-oauth.ts:8705](../../../server/routes-oauth.ts#L8705), [server/services/email-service.ts:125](../../../server/services/email-service.ts#L125), [server/services/email-service.ts:147](../../../server/services/email-service.ts#L147), [server/services/email-service.ts:163](../../../server/services/email-service.ts#L163) |
| ENCRYPTION_KEY | [server/utils/tokenVault.ts:30](../../../server/utils/tokenVault.ts#L30), [server/utils/tokenVault.ts:58](../../../server/utils/tokenVault.ts#L58), [server/utils/tokenVault.ts:76](../../../server/utils/tokenVault.ts#L76) |
| FACEBOOK_APP_ID | [server/routes-oauth.ts:24030](../../../server/routes-oauth.ts#L24030), [server/routes-oauth.ts:24162](../../../server/routes-oauth.ts#L24162) |
| FACEBOOK_APP_SECRET | [server/routes-oauth.ts:24031](../../../server/routes-oauth.ts#L24031), [server/routes-oauth.ts:24163](../../../server/routes-oauth.ts#L24163) |
| GA4_DAILY_LOOKBACK_DAYS | [server/ga4-daily-scheduler.ts:285](../../../server/ga4-daily-scheduler.ts#L285) |
| GA4_DAILY_PIPELINE_OWNS_RECOMPUTE | [server/kpi-scheduler.ts:472](../../../server/kpi-scheduler.ts#L472) |
| GA4_DAILY_PIPELINE_OWNS_REFRESH | [server/auto-refresh-scheduler.ts:1542](../../../server/auto-refresh-scheduler.ts#L1542) |
| GA4_DAILY_REFRESH_HOUR | [server/ga4-daily-scheduler.ts:240](../../../server/ga4-daily-scheduler.ts#L240), [server/utils/ga4-alert-current-value.ts:72](../../../server/utils/ga4-alert-current-value.ts#L72) |
| GA4_DAILY_REFRESH_HOURS | [server/ga4-daily-scheduler.ts:241](../../../server/ga4-daily-scheduler.ts#L241), [server/utils/ga4-alert-current-value.ts:67](../../../server/utils/ga4-alert-current-value.ts#L67) |
| GA4_DAILY_REFRESH_MINUTE | [server/ga4-daily-scheduler.ts:251](../../../server/ga4-daily-scheduler.ts#L251), [server/utils/ga4-alert-current-value.ts:74](../../../server/utils/ga4-alert-current-value.ts#L74) |
| GA4_DAILY_REFRESH_TIME_ZONE | [server/auto-refresh-scheduler.ts:92](../../../server/auto-refresh-scheduler.ts#L92), [server/ga4-daily-scheduler.ts:239](../../../server/ga4-daily-scheduler.ts#L239), [server/utils/ga4-alert-current-value.ts:71](../../../server/utils/ga4-alert-current-value.ts#L71) |
| GA4_DURABLE_RECOVERY_ENABLED | [server/ga4-daily-scheduler.ts:601](../../../server/ga4-daily-scheduler.ts#L601), [server/ga4-daily-scheduler.ts:615](../../../server/ga4-daily-scheduler.ts#L615), [server/ga4-daily-scheduler.ts:655](../../../server/ga4-daily-scheduler.ts#L655), [server/ga4-daily-scheduler.ts:690](../../../server/ga4-daily-scheduler.ts#L690), [server/ga4-daily-scheduler.ts:727](../../../server/ga4-daily-scheduler.ts#L727), [server/ga4-daily-scheduler.ts:1180](../../../server/ga4-daily-scheduler.ts#L1180), [server/routes-oauth.ts:9195](../../../server/routes-oauth.ts#L9195) |
| GA4_INCREMENTAL_REFRESH_ENABLED | [server/ga4-daily-scheduler.ts:385](../../../server/ga4-daily-scheduler.ts#L385) |
| GA4_OAUTH_STATE_SECRET | [server/routes-oauth.ts:16282](../../../server/routes-oauth.ts#L16282), [server/routes-oauth.ts:16295](../../../server/routes-oauth.ts#L16295) |
| GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS | [server/utils/ga4-service-account.ts:41](../../../server/utils/ga4-service-account.ts#L41) |
| GA4_SERVICE_ACCOUNT_JSON | [server/utils/ga4-service-account.ts:24](../../../server/utils/ga4-service-account.ts#L24), [server/utils/google-ads-service-account.ts:25](../../../server/utils/google-ads-service-account.ts#L25), [server/utils/google-sheets-service-account.ts:25](../../../server/utils/google-sheets-service-account.ts#L25) |
| GA4_TEST_CAMPAIGN | [server/test-support/ga4-recovery-process-worker.ts:33](../../../server/test-support/ga4-recovery-process-worker.ts#L33) |
| GA4_TEST_DATABASE_URL | [server/test-support/ga4-recovery-process-worker.ts:4](../../../server/test-support/ga4-recovery-process-worker.ts#L4) |
| GA4_TEST_DUE_AT | [server/test-support/ga4-recovery-process-worker.ts:35](../../../server/test-support/ga4-recovery-process-worker.ts#L35) |
| GA4_TEST_INITIAL_IMPORT | [server/test-support/ga4-recovery-process-worker.ts:43](../../../server/test-support/ga4-recovery-process-worker.ts#L43) |
| GA4_TEST_PAUSE_AT | [server/test-support/ga4-recovery-process-worker.ts:15](../../../server/test-support/ga4-recovery-process-worker.ts#L15), [server/test-support/ga4-recovery-process-worker.ts:37](../../../server/test-support/ga4-recovery-process-worker.ts#L37) |
| GA4_TEST_REPORTING_DATE | [server/test-support/ga4-recovery-process-worker.ts:34](../../../server/test-support/ga4-recovery-process-worker.ts#L34) |
| GA4_TEST_SCHEMA | [server/test-support/ga4-recovery-process-worker.ts:5](../../../server/test-support/ga4-recovery-process-worker.ts#L5) |
| GITHUB_SHA | [server/routes-oauth.ts:802](../../../server/routes-oauth.ts#L802) |
| GIT_COMMIT | [server/routes-oauth.ts:18660](../../../server/routes-oauth.ts#L18660) |
| GOOGLE_ADS_CLIENT_ID | [server/google-ads-scheduler.ts:151](../../../server/google-ads-scheduler.ts#L151), [server/routes-oauth.ts:26636](../../../server/routes-oauth.ts#L26636), [server/routes-oauth.ts:26638](../../../server/routes-oauth.ts#L26638), [server/routes-oauth.ts:27204](../../../server/routes-oauth.ts#L27204) |
| GOOGLE_ADS_CLIENT_SECRET | [server/google-ads-scheduler.ts:152](../../../server/google-ads-scheduler.ts#L152), [server/routes-oauth.ts:26636](../../../server/routes-oauth.ts#L26636), [server/routes-oauth.ts:26639](../../../server/routes-oauth.ts#L26639), [server/routes-oauth.ts:27205](../../../server/routes-oauth.ts#L27205) |
| GOOGLE_ADS_DEVELOPER_TOKEN | [server/google-ads-scheduler.ts:153](../../../server/google-ads-scheduler.ts#L153), [server/routes-oauth.ts:26717](../../../server/routes-oauth.ts#L26717), [server/routes-oauth.ts:26788](../../../server/routes-oauth.ts#L26788), [server/routes-oauth.ts:26862](../../../server/routes-oauth.ts#L26862), [server/routes-oauth.ts:26977](../../../server/routes-oauth.ts#L26977), [server/routes-oauth.ts:27206](../../../server/routes-oauth.ts#L27206) |
| GOOGLE_ADS_OAUTH_STATE_SECRET | [server/routes-oauth.ts:26644](../../../server/routes-oauth.ts#L26644) |
| GOOGLE_ADS_REFRESH_INTERVAL_HOURS | [server/google-ads-scheduler.ts:401](../../../server/google-ads-scheduler.ts#L401) |
| GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS | [server/utils/google-ads-service-account.ts:42](../../../server/utils/google-ads-service-account.ts#L42) |
| GOOGLE_ADS_SERVICE_ACCOUNT_JSON | [server/utils/google-ads-service-account.ts:25](../../../server/utils/google-ads-service-account.ts#L25) |
| GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID | [server/utils/google-ads-service-account.ts:47](../../../server/utils/google-ads-service-account.ts#L47) |
| GOOGLE_CLIENT_ID | [server/analytics.ts:2865](../../../server/analytics.ts#L2865), [server/analytics.ts:2879](../../../server/analytics.ts#L2879), [server/google-auth.ts:22](../../../server/google-auth.ts#L22), [server/real-ga4-client.ts:59](../../../server/real-ga4-client.ts#L59), [server/routes-oauth.ts:10812](../../../server/routes-oauth.ts#L10812), [server/routes-oauth.ts:10913](../../../server/routes-oauth.ts#L10913), [server/routes-oauth.ts:10997](../../../server/routes-oauth.ts#L10997), [server/routes-oauth.ts:11215](../../../server/routes-oauth.ts#L11215), [server/routes-oauth.ts:11245](../../../server/routes-oauth.ts#L11245), [server/routes-oauth.ts:12147](../../../server/routes-oauth.ts#L12147), [server/routes-oauth.ts:12149](../../../server/routes-oauth.ts#L12149), [server/routes-oauth.ts:12907](../../../server/routes-oauth.ts#L12907), [server/routes-oauth.ts:13087](../../../server/routes-oauth.ts#L13087), [server/routes-oauth.ts:14134](../../../server/routes-oauth.ts#L14134), [server/routes-oauth.ts:14187](../../../server/routes-oauth.ts#L14187), [server/routes-oauth.ts:16241](../../../server/routes-oauth.ts#L16241), [server/routes-oauth.ts:16364](../../../server/routes-oauth.ts#L16364), [server/routes-oauth.ts:16879](../../../server/routes-oauth.ts#L16879), [server/routes-oauth.ts:16881](../../../server/routes-oauth.ts#L16881), [server/routes-oauth.ts:16884](../../../server/routes-oauth.ts#L16884), [server/routes-oauth.ts:16970](../../../server/routes-oauth.ts#L16970), [server/routes-oauth.ts:17157](../../../server/routes-oauth.ts#L17157), [server/routes-oauth.ts:26638](../../../server/routes-oauth.ts#L26638) |
| GOOGLE_CLIENT_SECRET | [server/analytics.ts:2865](../../../server/analytics.ts#L2865), [server/analytics.ts:2880](../../../server/analytics.ts#L2880), [server/google-auth.ts:23](../../../server/google-auth.ts#L23), [server/real-ga4-client.ts:60](../../../server/real-ga4-client.ts#L60), [server/routes-oauth.ts:10998](../../../server/routes-oauth.ts#L10998), [server/routes-oauth.ts:11216](../../../server/routes-oauth.ts#L11216), [server/routes-oauth.ts:11246](../../../server/routes-oauth.ts#L11246), [server/routes-oauth.ts:12147](../../../server/routes-oauth.ts#L12147), [server/routes-oauth.ts:12150](../../../server/routes-oauth.ts#L12150), [server/routes-oauth.ts:13088](../../../server/routes-oauth.ts#L13088), [server/routes-oauth.ts:14135](../../../server/routes-oauth.ts#L14135), [server/routes-oauth.ts:14188](../../../server/routes-oauth.ts#L14188), [server/routes-oauth.ts:16242](../../../server/routes-oauth.ts#L16242), [server/routes-oauth.ts:16879](../../../server/routes-oauth.ts#L16879), [server/routes-oauth.ts:16882](../../../server/routes-oauth.ts#L16882), [server/routes-oauth.ts:16885](../../../server/routes-oauth.ts#L16885), [server/routes-oauth.ts:16971](../../../server/routes-oauth.ts#L16971), [server/routes-oauth.ts:17158](../../../server/routes-oauth.ts#L17158), [server/routes-oauth.ts:26639](../../../server/routes-oauth.ts#L26639) |
| GOOGLE_SHEETS_OAUTH_STATE_SECRET | [server/routes-oauth.ts:16319](../../../server/routes-oauth.ts#L16319), [server/routes-oauth.ts:16332](../../../server/routes-oauth.ts#L16332) |
| GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON | [server/utils/google-sheets-service-account.ts:25](../../../server/utils/google-sheets-service-account.ts#L25) |
| GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES | [server/auto-refresh-scheduler.ts:96](../../../server/auto-refresh-scheduler.ts#L96) |
| GOOGLE_SHEETS_TOKEN_REFRESH_INTERVAL_HOURS | [server/google-sheets-token-scheduler.ts:177](../../../server/google-sheets-token-scheduler.ts#L177) |
| HUBSPOT_CLIENT_ID | [server/routes-oauth.ts:11366](../../../server/routes-oauth.ts#L11366), [server/routes-oauth.ts:11994](../../../server/routes-oauth.ts#L11994) |
| HUBSPOT_CLIENT_SECRET | [server/routes-oauth.ts:11995](../../../server/routes-oauth.ts#L11995) |
| HUBSPOT_OAUTH_STATE_SECRET | [server/routes-oauth.ts:11301](../../../server/routes-oauth.ts#L11301) |
| INDUSTRY_BENCHMARKS_DATASET | [server/routes-oauth.ts:8785](../../../server/routes-oauth.ts#L8785) |
| INSTAGRAM_REFRESH_INTERVAL_HOURS | [server/instagram-scheduler.ts:106](../../../server/instagram-scheduler.ts#L106) |
| LINKEDIN_CLIENT_ID | [server/routes-oauth.ts:23474](../../../server/routes-oauth.ts#L23474), [server/routes-oauth.ts:23606](../../../server/routes-oauth.ts#L23606) |
| LINKEDIN_CLIENT_SECRET | [server/routes-oauth.ts:23475](../../../server/routes-oauth.ts#L23475), [server/routes-oauth.ts:23607](../../../server/routes-oauth.ts#L23607) |
| LINKEDIN_OAUTH_STATE_SECRET | [server/routes-oauth.ts:23406](../../../server/routes-oauth.ts#L23406), [server/routes-oauth.ts:23426](../../../server/routes-oauth.ts#L23426) |
| LINKEDIN_REFRESH_INTERVAL_HOURS | [server/linkedin-scheduler.ts:779](../../../server/linkedin-scheduler.ts#L779) |
| LINKEDIN_TEST_MODE | [server/benchmark-notifications.ts:185](../../../server/benchmark-notifications.ts#L185), [server/kpi-notifications.ts:162](../../../server/kpi-notifications.ts#L162), [server/linkedin-scheduler.ts:700](../../../server/linkedin-scheduler.ts#L700) |
| MAILGUN_API_KEY | [server/report-scheduler.ts:4626](../../../server/report-scheduler.ts#L4626), [server/routes-oauth.ts:7826](../../../server/routes-oauth.ts#L7826), [server/routes-oauth.ts:8702](../../../server/routes-oauth.ts#L8702), [server/services/email-service.ts:101](../../../server/services/email-service.ts#L101), [server/services/email-service.ts:185](../../../server/services/email-service.ts#L185), [server/services/email-service.ts:254](../../../server/services/email-service.ts#L254), [server/utils/mailgun-delivery.ts:33](../../../server/utils/mailgun-delivery.ts#L33) |
| MAILGUN_DOMAIN | [server/report-scheduler.ts:4626](../../../server/report-scheduler.ts#L4626), [server/routes-oauth.ts:7826](../../../server/routes-oauth.ts#L7826), [server/routes-oauth.ts:8702](../../../server/routes-oauth.ts#L8702), [server/services/email-service.ts:101](../../../server/services/email-service.ts#L101), [server/services/email-service.ts:185](../../../server/services/email-service.ts#L185), [server/services/email-service.ts:253](../../../server/services/email-service.ts#L253), [server/utils/mailgun-delivery.ts:32](../../../server/utils/mailgun-delivery.ts#L32) |
| MAILGUN_REGION | [server/services/email-service.ts:255](../../../server/services/email-service.ts#L255), [server/utils/mailgun-delivery.ts:36](../../../server/utils/mailgun-delivery.ts#L36) |
| MAILGUN_SMTP_HOST | [server/services/email-service.ts:131](../../../server/services/email-service.ts#L131) |
| MAILGUN_SMTP_PASS | [server/report-scheduler.ts:4627](../../../server/report-scheduler.ts#L4627), [server/routes-oauth.ts:7827](../../../server/routes-oauth.ts#L7827), [server/routes-oauth.ts:8703](../../../server/routes-oauth.ts#L8703), [server/services/email-service.ts:101](../../../server/services/email-service.ts#L101), [server/services/email-service.ts:139](../../../server/services/email-service.ts#L139), [server/services/email-service.ts:147](../../../server/services/email-service.ts#L147) |
| MAILGUN_SMTP_PORT | [server/services/email-service.ts:132](../../../server/services/email-service.ts#L132) |
| MAILGUN_SMTP_USER | [server/report-scheduler.ts:4627](../../../server/report-scheduler.ts#L4627), [server/routes-oauth.ts:7827](../../../server/routes-oauth.ts#L7827), [server/routes-oauth.ts:8703](../../../server/routes-oauth.ts#L8703), [server/services/email-service.ts:101](../../../server/services/email-service.ts#L101), [server/services/email-service.ts:133](../../../server/services/email-service.ts#L133) |
| MAILGUN_WEBHOOK_SIGNING_KEY | [server/routes-oauth.ts:33949](../../../server/routes-oauth.ts#L33949), [server/routes-oauth.ts:33957](../../../server/routes-oauth.ts#L33957) |
| META_APP_ID | [server/routes-oauth.ts:24030](../../../server/routes-oauth.ts#L24030), [server/routes-oauth.ts:24162](../../../server/routes-oauth.ts#L24162) |
| META_APP_SECRET | [server/routes-oauth.ts:24031](../../../server/routes-oauth.ts#L24031), [server/routes-oauth.ts:24163](../../../server/routes-oauth.ts#L24163) |
| META_OAUTH_STATE_SECRET | [server/routes-oauth.ts:23955](../../../server/routes-oauth.ts#L23955), [server/routes-oauth.ts:23975](../../../server/routes-oauth.ts#L23975) |
| META_REFRESH_INTERVAL_HOURS | [server/meta-scheduler.ts:403](../../../server/meta-scheduler.ts#L403) |
| META_TEST_MODE | [server/meta-scheduler.ts:329](../../../server/meta-scheduler.ts#L329) |
| NODE_ENV | [server/google-auth.ts:24](../../../server/google-auth.ts#L24), [server/index.ts:26](../../../server/index.ts#L26), [server/integrated-ga4-auth.ts:42](../../../server/integrated-ga4-auth.ts#L42), [server/real-ga4-client.ts:50](../../../server/real-ga4-client.ts#L50), [server/report-scheduler.ts:1226](../../../server/report-scheduler.ts#L1226), [server/routes-oauth.ts:809](../../../server/routes-oauth.ts#L809), [server/routes-oauth.ts:847](../../../server/routes-oauth.ts#L847), [server/routes-oauth.ts:7759](../../../server/routes-oauth.ts#L7759), [server/routes-oauth.ts:7809](../../../server/routes-oauth.ts#L7809), [server/routes-oauth.ts:8342](../../../server/routes-oauth.ts#L8342), [server/routes-oauth.ts:8472](../../../server/routes-oauth.ts#L8472), [server/routes-oauth.ts:8730](../../../server/routes-oauth.ts#L8730), [server/routes-oauth.ts:14593](../../../server/routes-oauth.ts#L14593), [server/routes-oauth.ts:17461](../../../server/routes-oauth.ts#L17461), [server/routes-oauth.ts:23135](../../../server/routes-oauth.ts#L23135), [server/routes-oauth.ts:24422](../../../server/routes-oauth.ts#L24422), [server/routes-oauth.ts:26646](../../../server/routes-oauth.ts#L26646), [server/routes-oauth.ts:28532](../../../server/routes-oauth.ts#L28532), [server/routes-oauth.ts:28640](../../../server/routes-oauth.ts#L28640), [server/storage.ts:22](../../../server/storage.ts#L22), [server/test-support/ga4-recovery-process-worker.ts:11](../../../server/test-support/ga4-recovery-process-worker.ts#L11), [server/utils/tokenVault.ts:57](../../../server/utils/tokenVault.ts#L57), [server/utils/tokenVault.ts:80](../../../server/utils/tokenVault.ts#L80) |
| PORT | [server/auto-refresh-scheduler.ts:181](../../../server/auto-refresh-scheduler.ts#L181), [server/index.ts:256](../../../server/index.ts#L256) |
| RENDER_EXTERNAL_URL | [server/real-ga4-client.ts:48](../../../server/real-ga4-client.ts#L48), [server/routes-oauth.ts:7295](../../../server/routes-oauth.ts#L7295), [server/routes-oauth.ts:10901](../../../server/routes-oauth.ts#L10901), [server/routes-oauth.ts:11000](../../../server/routes-oauth.ts#L11000), [server/routes-oauth.ts:11201](../../../server/routes-oauth.ts#L11201), [server/routes-oauth.ts:11360](../../../server/routes-oauth.ts#L11360), [server/routes-oauth.ts:11401](../../../server/routes-oauth.ts#L11401), [server/routes-oauth.ts:11563](../../../server/routes-oauth.ts#L11563), [server/routes-oauth.ts:11988](../../../server/routes-oauth.ts#L11988), [server/routes-oauth.ts:16372](../../../server/routes-oauth.ts#L16372), [server/routes-oauth.ts:23487](../../../server/routes-oauth.ts#L23487), [server/routes-oauth.ts:23615](../../../server/routes-oauth.ts#L23615), [server/routes-oauth.ts:24043](../../../server/routes-oauth.ts#L24043), [server/routes-oauth.ts:24171](../../../server/routes-oauth.ts#L24171), [server/routes-oauth.ts:26799](../../../server/routes-oauth.ts#L26799), [server/routes-oauth.ts:26864](../../../server/routes-oauth.ts#L26864) |
| RENDER_GIT_COMMIT | [server/routes-oauth.ts:801](../../../server/routes-oauth.ts#L801), [server/routes-oauth.ts:18660](../../../server/routes-oauth.ts#L18660) |
| REPLIT_DOMAIN | [server/real-ga4-client.ts:49](../../../server/real-ga4-client.ts#L49), [server/real-ga4-client.ts:49](../../../server/real-ga4-client.ts#L49), [server/routes-oauth.ts:10902](../../../server/routes-oauth.ts#L10902), [server/routes-oauth.ts:10902](../../../server/routes-oauth.ts#L10902), [server/routes-oauth.ts:11001](../../../server/routes-oauth.ts#L11001), [server/routes-oauth.ts:11001](../../../server/routes-oauth.ts#L11001), [server/routes-oauth.ts:11202](../../../server/routes-oauth.ts#L11202), [server/routes-oauth.ts:11202](../../../server/routes-oauth.ts#L11202), [server/routes-oauth.ts:11361](../../../server/routes-oauth.ts#L11361), [server/routes-oauth.ts:11361](../../../server/routes-oauth.ts#L11361), [server/routes-oauth.ts:11402](../../../server/routes-oauth.ts#L11402), [server/routes-oauth.ts:11402](../../../server/routes-oauth.ts#L11402), [server/routes-oauth.ts:11564](../../../server/routes-oauth.ts#L11564), [server/routes-oauth.ts:11564](../../../server/routes-oauth.ts#L11564), [server/routes-oauth.ts:11989](../../../server/routes-oauth.ts#L11989), [server/routes-oauth.ts:11989](../../../server/routes-oauth.ts#L11989), [server/routes-oauth.ts:16373](../../../server/routes-oauth.ts#L16373), [server/routes-oauth.ts:16373](../../../server/routes-oauth.ts#L16373), [server/routes-oauth.ts:23488](../../../server/routes-oauth.ts#L23488), [server/routes-oauth.ts:23488](../../../server/routes-oauth.ts#L23488), [server/routes-oauth.ts:23616](../../../server/routes-oauth.ts#L23616), [server/routes-oauth.ts:23616](../../../server/routes-oauth.ts#L23616), [server/routes-oauth.ts:24044](../../../server/routes-oauth.ts#L24044), [server/routes-oauth.ts:24044](../../../server/routes-oauth.ts#L24044), [server/routes-oauth.ts:24172](../../../server/routes-oauth.ts#L24172), [server/routes-oauth.ts:24172](../../../server/routes-oauth.ts#L24172), [server/routes-oauth.ts:26800](../../../server/routes-oauth.ts#L26800), [server/routes-oauth.ts:26800](../../../server/routes-oauth.ts#L26800), [server/routes-oauth.ts:26865](../../../server/routes-oauth.ts#L26865), [server/routes-oauth.ts:26865](../../../server/routes-oauth.ts#L26865) |
| REPLIT_DOMAINS | [server/google-auth.ts:25](../../../server/google-auth.ts#L25) |
| REPORT_SCHEDULER_CRON | [server/report-scheduler.ts:4811](../../../server/report-scheduler.ts#L4811) |
| RUN_REPORT_SCHEDULER_ON_STARTUP | [server/report-scheduler.ts:4816](../../../server/report-scheduler.ts#L4816) |
| SALESFORCE_API_VERSION | [server/routes-oauth.ts:11623](../../../server/routes-oauth.ts#L11623), [server/routes-oauth.ts:17779](../../../server/routes-oauth.ts#L17779), [server/routes-oauth.ts:18257](../../../server/routes-oauth.ts#L18257), [server/routes-oauth.ts:18309](../../../server/routes-oauth.ts#L18309), [server/routes-oauth.ts:18340](../../../server/routes-oauth.ts#L18340), [server/routes-oauth.ts:18487](../../../server/routes-oauth.ts#L18487), [server/routes-oauth.ts:18747](../../../server/routes-oauth.ts#L18747), [server/routes-oauth.ts:19425](../../../server/routes-oauth.ts#L19425) |
| SALESFORCE_AUTH_BASE_URL | [server/routes-oauth.ts:11413](../../../server/routes-oauth.ts#L11413), [server/routes-oauth.ts:11575](../../../server/routes-oauth.ts#L11575), [server/routes-oauth.ts:18631](../../../server/routes-oauth.ts#L18631), [server/routes-oauth.ts:18887](../../../server/routes-oauth.ts#L18887), [server/routes-oauth.ts:20986](../../../server/routes-oauth.ts#L20986), [server/utils/salesforceCurrency.ts:110](../../../server/utils/salesforceCurrency.ts#L110) |
| SALESFORCE_CLIENT_ID | [server/routes-oauth.ts:11407](../../../server/routes-oauth.ts#L11407), [server/routes-oauth.ts:11569](../../../server/routes-oauth.ts#L11569) |
| SALESFORCE_CLIENT_SECRET | [server/routes-oauth.ts:11570](../../../server/routes-oauth.ts#L11570) |
| SALESFORCE_OAUTH_SCOPE | [server/routes-oauth.ts:11416](../../../server/routes-oauth.ts#L11416) |
| SALESFORCE_OAUTH_SCOPES | [server/routes-oauth.ts:11416](../../../server/routes-oauth.ts#L11416) |
| SALESFORCE_PIPELINE_REFRESH_INTERVAL_MINUTES | [server/auto-refresh-scheduler.ts:97](../../../server/auto-refresh-scheduler.ts#L97) |
| SENDGRID_API_KEY | [server/report-scheduler.ts:4628](../../../server/report-scheduler.ts#L4628), [server/routes-oauth.ts:7828](../../../server/routes-oauth.ts#L7828), [server/routes-oauth.ts:8704](../../../server/routes-oauth.ts#L8704), [server/services/email-service.ts:103](../../../server/services/email-service.ts#L103), [server/services/email-service.ts:125](../../../server/services/email-service.ts#L125) |
| SENDGRID_WEBHOOK_VERIFICATION_KEY | [server/routes-oauth.ts:33814](../../../server/routes-oauth.ts#L33814), [server/routes-oauth.ts:33822](../../../server/routes-oauth.ts#L33822) |
| SESSION_SECRET | [server/routes-oauth.ts:11301](../../../server/routes-oauth.ts#L11301), [server/routes-oauth.ts:23407](../../../server/routes-oauth.ts#L23407), [server/routes-oauth.ts:23427](../../../server/routes-oauth.ts#L23427), [server/routes-oauth.ts:23956](../../../server/routes-oauth.ts#L23956), [server/routes-oauth.ts:23976](../../../server/routes-oauth.ts#L23976), [server/routes-oauth.ts:26644](../../../server/routes-oauth.ts#L26644), [server/utils/tokenVault.ts:31](../../../server/utils/tokenVault.ts#L31), [server/utils/tokenVault.ts:74](../../../server/utils/tokenVault.ts#L74), [server/utils/tokenVault.ts:159](../../../server/utils/tokenVault.ts#L159), [server/utils/tokenVault.ts:165](../../../server/utils/tokenVault.ts#L165) |
| SHOPIFY_API_VERSION | [server/utils/shopify-provider.ts:16](../../../server/utils/shopify-provider.ts#L16) |
| SHOPIFY_APP_BASE_URL | [server/routes-oauth.ts:7298](../../../server/routes-oauth.ts#L7298) |
| SHOPIFY_CLIENT_ID | [server/routes-oauth.ts:7302](../../../server/routes-oauth.ts#L7302), [server/routes-oauth.ts:11459](../../../server/routes-oauth.ts#L11459), [server/routes-oauth.ts:11847](../../../server/routes-oauth.ts#L11847), [server/routes-oauth.ts:35625](../../../server/routes-oauth.ts#L35625) |
| SHOPIFY_CLIENT_SECRET | [server/routes-oauth.ts:7303](../../../server/routes-oauth.ts#L7303), [server/routes-oauth.ts:11806](../../../server/routes-oauth.ts#L11806), [server/routes-oauth.ts:35626](../../../server/routes-oauth.ts#L35626) |
| SHOPIFY_REDIRECT_URI | [server/routes-oauth.ts:7284](../../../server/routes-oauth.ts#L7284) |
| SHOPIFY_SCOPES | [server/routes-oauth.ts:7304](../../../server/routes-oauth.ts#L7304), [server/routes-oauth.ts:11460](../../../server/routes-oauth.ts#L11460) |
| SMTP_HOST | [server/services/email-service.ts:158](../../../server/services/email-service.ts#L158) |
| SMTP_PASS | [server/report-scheduler.ts:4629](../../../server/report-scheduler.ts#L4629), [server/routes-oauth.ts:7830](../../../server/routes-oauth.ts#L7830), [server/routes-oauth.ts:8706](../../../server/routes-oauth.ts#L8706), [server/services/email-service.ts:163](../../../server/services/email-service.ts#L163) |
| SMTP_PORT | [server/services/email-service.ts:159](../../../server/services/email-service.ts#L159) |
| SMTP_SECURE | [server/services/email-service.ts:160](../../../server/services/email-service.ts#L160) |
| SMTP_USER | [server/report-scheduler.ts:4629](../../../server/report-scheduler.ts#L4629), [server/services/email-service.ts:162](../../../server/services/email-service.ts#L162) |
| SNAPSHOT_FREQUENCY | [server/scheduler.ts:868](../../../server/scheduler.ts#L868) |
| TIKTOK_REFRESH_INTERVAL_HOURS | [server/tiktok-scheduler.ts:136](../../../server/tiktok-scheduler.ts#L136) |
| TOKEN_ENCRYPTION_KEY | [server/utils/tokenVault.ts:29](../../../server/utils/tokenVault.ts#L29), [server/utils/tokenVault.ts:58](../../../server/utils/tokenVault.ts#L58), [server/utils/tokenVault.ts:75](../../../server/utils/tokenVault.ts#L75) |
| TOKEN_ENCRYPTION_SIGNING_SECRET | [server/utils/tokenVault.ts:159](../../../server/utils/tokenVault.ts#L159), [server/utils/tokenVault.ts:165](../../../server/utils/tokenVault.ts#L165) |
| VERCEL_GIT_COMMIT_SHA | [server/routes-oauth.ts:803](../../../server/routes-oauth.ts#L803) |
| VITE_CLERK_PUBLISHABLE_KEY | [client/src/main.tsx:6](../../../client/src/main.tsx#L6), [server/index.ts:65](../../../server/index.ts#L65), [server/index.ts:66](../../../server/index.ts#L66) |
| VITE_ENABLE_AD_PLATFORM_TEST_MODE | [client/src/components/AddSpendWizardModal.tsx:33](../../../client/src/components/AddSpendWizardModal.tsx#L33) |
| VITE_ENABLE_SALESFORCE_REVENUE_SOURCE | [client/src/components/AddRevenueWizardModal.tsx:23](../../../client/src/components/AddRevenueWizardModal.tsx#L23) |
| YESOP_ANCHOR_DATE_UTC | [server/routes-oauth.ts:968](../../../server/routes-oauth.ts#L968) |

## Declared user controls

926 button/menu/link/form/event controls are retained with file, line, attributes and markup in inventory.json. This includes hidden and conditional controls. Dynamic child labels and reachability are not inferred from an AST node.


# Observed configuration catalog

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. Names and source expressions only; no local/deployed environment values. [Contract review and limitations](CONFIGURATION_AND_RECOVERY.md). All119 observed names are listed; seven test-worker controls and the Vite DEV constant are explicitly distinguished. SDK-owned Clerk settings and build-tool settings outside client/server/shared are listed separately in the contract review.

| Name | Boundary | Exact source access |
|---|---|---|
| ALERT_EMAIL_REMINDER_INTERVAL_MS | Server/runtime configuration; deployed value unverified | `server/alert-email-scheduler.ts:26` |
| ALERT_EMAIL_REMINDER_SCHEDULER_ENABLED | Server/runtime configuration; deployed value unverified | `server/alert-email-scheduler.ts:24` |
| ALLOW_MOCK_DATA | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:8341`, `server/routes-oauth.ts:8471` |
| APP_BASE_URL | Server/runtime configuration; deployed value unverified | `server/real-ga4-client.ts:47`, `server/routes-oauth.ts:7295`, `server/routes-oauth.ts:10900`, `server/routes-oauth.ts:11000`, `server/routes-oauth.ts:11200`, `server/routes-oauth.ts:11359`, `server/routes-oauth.ts:11400`, `server/routes-oauth.ts:11562`, `server/routes-oauth.ts:11987`, `server/routes-oauth.ts:16372`, `server/routes-oauth.ts:23486`, `server/routes-oauth.ts:23614`, `server/routes-oauth.ts:24042`, `server/routes-oauth.ts:24170`, `server/routes-oauth.ts:26799`, `server/routes-oauth.ts:26864` |
| APP_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11301`, `server/routes-oauth.ts:23408`, `server/routes-oauth.ts:23428`, `server/routes-oauth.ts:23957`, `server/routes-oauth.ts:23977`, `server/routes-oauth.ts:26644`, `server/utils/tokenVault.ts:32` |
| AUTO_REFRESH_DAILY_HOUR | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:93` |
| AUTO_REFRESH_DAILY_MINUTE | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:94` |
| AUTO_REFRESH_ENABLED | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:91` |
| AUTO_REFRESH_INTERNAL_TIMEOUT_MS | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:188` |
| AUTO_REFRESH_LINKEDIN_TIMEOUT_MS | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:1097` |
| AUTO_REFRESH_RUN_ON_STARTUP | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:95` |
| AUTO_REFRESH_TIME_ZONE | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:92` |
| CLERK_PUBLISHABLE_KEY | Server/runtime configuration; deployed value unverified | `server/index.ts:65`, `server/index.ts:66` |
| COMMIT_SHA | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:804` |
| DATABASE_URL | Server/runtime configuration; deployed value unverified | `server/db.ts:5`, `server/test-support/ga4-recovery-process-worker.ts:7`, `server/test-support/ga4-recovery-process-worker.ts:10` |
| DEV | Vite compile-time constant | `client/src/components/LinkedInConnectionFlow.tsx:201`, `client/src/components/LinkedInUiStates.tsx:111`, `client/src/pages/campaign-detail.tsx:79`, `client/src/pages/campaign-detail.tsx:86`, `client/src/pages/linkedin-analytics.tsx:108` |
| EMAIL_DOMAIN | Server/runtime configuration; deployed value unverified | `server/utils/email-generator.ts:20`, `server/utils/email-generator.ts:30` |
| EMAIL_FROM_ADDRESS | Server/runtime configuration; deployed value unverified | `server/services/alert-monitoring.ts:111`, `server/services/email-service.ts:108` |
| EMAIL_PROVIDER | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4624`, `server/services/email-service.ts:104` |
| EMAIL_SERVICE_API_KEY | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:7829`, `server/routes-oauth.ts:8705`, `server/services/email-service.ts:125`, `server/services/email-service.ts:147`, `server/services/email-service.ts:163` |
| ENCRYPTION_KEY | Server/runtime configuration; deployed value unverified | `server/utils/tokenVault.ts:30`, `server/utils/tokenVault.ts:58`, `server/utils/tokenVault.ts:76` |
| FACEBOOK_APP_ID | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:24030`, `server/routes-oauth.ts:24162` |
| FACEBOOK_APP_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:24031`, `server/routes-oauth.ts:24163` |
| GA4_DAILY_LOOKBACK_DAYS | Server/runtime configuration; deployed value unverified | `server/ga4-daily-scheduler.ts:285` |
| GA4_DAILY_PIPELINE_OWNS_RECOMPUTE | Server/runtime configuration; deployed value unverified | `server/kpi-scheduler.ts:472` |
| GA4_DAILY_PIPELINE_OWNS_REFRESH | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:1542` |
| GA4_DAILY_REFRESH_HOUR | Server/runtime configuration; deployed value unverified | `server/ga4-daily-scheduler.ts:240`, `server/utils/ga4-alert-current-value.ts:72` |
| GA4_DAILY_REFRESH_HOURS | Server/runtime configuration; deployed value unverified | `server/ga4-daily-scheduler.ts:241`, `server/utils/ga4-alert-current-value.ts:67` |
| GA4_DAILY_REFRESH_MINUTE | Server/runtime configuration; deployed value unverified | `server/ga4-daily-scheduler.ts:251`, `server/utils/ga4-alert-current-value.ts:74` |
| GA4_DAILY_REFRESH_TIME_ZONE | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:92`, `server/ga4-daily-scheduler.ts:239`, `server/utils/ga4-alert-current-value.ts:71` |
| GA4_DURABLE_RECOVERY_ENABLED | Server/runtime configuration; deployed value unverified | `server/ga4-daily-scheduler.ts:601`, `server/ga4-daily-scheduler.ts:615`, `server/ga4-daily-scheduler.ts:655`, `server/ga4-daily-scheduler.ts:690`, `server/ga4-daily-scheduler.ts:727`, `server/ga4-daily-scheduler.ts:1180`, `server/routes-oauth.ts:9195` |
| GA4_INCREMENTAL_REFRESH_ENABLED | Server/runtime configuration; deployed value unverified | `server/ga4-daily-scheduler.ts:385` |
| GA4_OAUTH_STATE_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:16282`, `server/routes-oauth.ts:16295` |
| GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS | Server/runtime configuration; deployed value unverified | `server/utils/ga4-service-account.ts:41` |
| GA4_SERVICE_ACCOUNT_JSON | Server/runtime configuration; deployed value unverified | `server/utils/ga4-service-account.ts:24`, `server/utils/google-ads-service-account.ts:25`, `server/utils/google-sheets-service-account.ts:25` |
| GA4_TEST_CAMPAIGN | Isolated test worker only | `server/test-support/ga4-recovery-process-worker.ts:33` |
| GA4_TEST_DATABASE_URL | Isolated test worker only | `server/test-support/ga4-recovery-process-worker.ts:4` |
| GA4_TEST_DUE_AT | Isolated test worker only | `server/test-support/ga4-recovery-process-worker.ts:35` |
| GA4_TEST_INITIAL_IMPORT | Isolated test worker only | `server/test-support/ga4-recovery-process-worker.ts:43` |
| GA4_TEST_PAUSE_AT | Isolated test worker only | `server/test-support/ga4-recovery-process-worker.ts:15`, `server/test-support/ga4-recovery-process-worker.ts:37` |
| GA4_TEST_REPORTING_DATE | Isolated test worker only | `server/test-support/ga4-recovery-process-worker.ts:34` |
| GA4_TEST_SCHEMA | Isolated test worker only | `server/test-support/ga4-recovery-process-worker.ts:5` |
| GITHUB_SHA | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:802` |
| GIT_COMMIT | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:18660` |
| GOOGLE_ADS_CLIENT_ID | Server/runtime configuration; deployed value unverified | `server/google-ads-scheduler.ts:151`, `server/routes-oauth.ts:26636`, `server/routes-oauth.ts:26638`, `server/routes-oauth.ts:27204` |
| GOOGLE_ADS_CLIENT_SECRET | Server/runtime configuration; deployed value unverified | `server/google-ads-scheduler.ts:152`, `server/routes-oauth.ts:26636`, `server/routes-oauth.ts:26639`, `server/routes-oauth.ts:27205` |
| GOOGLE_ADS_DEVELOPER_TOKEN | Server/runtime configuration; deployed value unverified | `server/google-ads-scheduler.ts:153`, `server/routes-oauth.ts:26717`, `server/routes-oauth.ts:26788`, `server/routes-oauth.ts:26862`, `server/routes-oauth.ts:26977`, `server/routes-oauth.ts:27206` |
| GOOGLE_ADS_OAUTH_STATE_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:26644` |
| GOOGLE_ADS_REFRESH_INTERVAL_HOURS | Server/runtime configuration; deployed value unverified | `server/google-ads-scheduler.ts:401` |
| GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS | Server/runtime configuration; deployed value unverified | `server/utils/google-ads-service-account.ts:42` |
| GOOGLE_ADS_SERVICE_ACCOUNT_JSON | Server/runtime configuration; deployed value unverified | `server/utils/google-ads-service-account.ts:25` |
| GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID | Server/runtime configuration; deployed value unverified | `server/utils/google-ads-service-account.ts:47` |
| GOOGLE_CLIENT_ID | Server/runtime configuration; deployed value unverified | `server/analytics.ts:2865`, `server/analytics.ts:2879`, `server/google-auth.ts:22`, `server/real-ga4-client.ts:59`, `server/routes-oauth.ts:10812`, `server/routes-oauth.ts:10913`, `server/routes-oauth.ts:10997`, `server/routes-oauth.ts:11215`, `server/routes-oauth.ts:11245`, `server/routes-oauth.ts:12147`, `server/routes-oauth.ts:12149`, `server/routes-oauth.ts:12907`, `server/routes-oauth.ts:13087`, `server/routes-oauth.ts:14134`, `server/routes-oauth.ts:14187`, `server/routes-oauth.ts:16241`, `server/routes-oauth.ts:16364`, `server/routes-oauth.ts:16879`, `server/routes-oauth.ts:16881`, `server/routes-oauth.ts:16884`, `server/routes-oauth.ts:16970`, `server/routes-oauth.ts:17157`, `server/routes-oauth.ts:26638` |
| GOOGLE_CLIENT_SECRET | Server/runtime configuration; deployed value unverified | `server/analytics.ts:2865`, `server/analytics.ts:2880`, `server/google-auth.ts:23`, `server/real-ga4-client.ts:60`, `server/routes-oauth.ts:10998`, `server/routes-oauth.ts:11216`, `server/routes-oauth.ts:11246`, `server/routes-oauth.ts:12147`, `server/routes-oauth.ts:12150`, `server/routes-oauth.ts:13088`, `server/routes-oauth.ts:14135`, `server/routes-oauth.ts:14188`, `server/routes-oauth.ts:16242`, `server/routes-oauth.ts:16879`, `server/routes-oauth.ts:16882`, `server/routes-oauth.ts:16885`, `server/routes-oauth.ts:16971`, `server/routes-oauth.ts:17158`, `server/routes-oauth.ts:26639` |
| GOOGLE_SHEETS_OAUTH_STATE_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:16319`, `server/routes-oauth.ts:16332` |
| GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON | Server/runtime configuration; deployed value unverified | `server/utils/google-sheets-service-account.ts:25` |
| GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:96` |
| GOOGLE_SHEETS_TOKEN_REFRESH_INTERVAL_HOURS | Server/runtime configuration; deployed value unverified | `server/google-sheets-token-scheduler.ts:177` |
| HUBSPOT_CLIENT_ID | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11366`, `server/routes-oauth.ts:11994` |
| HUBSPOT_CLIENT_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11995` |
| HUBSPOT_OAUTH_STATE_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11301` |
| INDUSTRY_BENCHMARKS_DATASET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:8785` |
| INSTAGRAM_REFRESH_INTERVAL_HOURS | Server/runtime configuration; deployed value unverified | `server/instagram-scheduler.ts:106` |
| LINKEDIN_CLIENT_ID | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:23474`, `server/routes-oauth.ts:23606` |
| LINKEDIN_CLIENT_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:23475`, `server/routes-oauth.ts:23607` |
| LINKEDIN_OAUTH_STATE_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:23406`, `server/routes-oauth.ts:23426` |
| LINKEDIN_REFRESH_INTERVAL_HOURS | Server/runtime configuration; deployed value unverified | `server/linkedin-scheduler.ts:779` |
| LINKEDIN_TEST_MODE | Server/runtime configuration; deployed value unverified | `server/benchmark-notifications.ts:185`, `server/kpi-notifications.ts:162`, `server/linkedin-scheduler.ts:700` |
| MAILGUN_API_KEY | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4626`, `server/routes-oauth.ts:7826`, `server/routes-oauth.ts:8702`, `server/services/email-service.ts:101`, `server/services/email-service.ts:185`, `server/services/email-service.ts:254`, `server/utils/mailgun-delivery.ts:33` |
| MAILGUN_DOMAIN | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4626`, `server/routes-oauth.ts:7826`, `server/routes-oauth.ts:8702`, `server/services/email-service.ts:101`, `server/services/email-service.ts:185`, `server/services/email-service.ts:253`, `server/utils/mailgun-delivery.ts:32` |
| MAILGUN_REGION | Server/runtime configuration; deployed value unverified | `server/services/email-service.ts:255`, `server/utils/mailgun-delivery.ts:36` |
| MAILGUN_SMTP_HOST | Server/runtime configuration; deployed value unverified | `server/services/email-service.ts:131` |
| MAILGUN_SMTP_PASS | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4627`, `server/routes-oauth.ts:7827`, `server/routes-oauth.ts:8703`, `server/services/email-service.ts:101`, `server/services/email-service.ts:139`, `server/services/email-service.ts:147` |
| MAILGUN_SMTP_PORT | Server/runtime configuration; deployed value unverified | `server/services/email-service.ts:132` |
| MAILGUN_SMTP_USER | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4627`, `server/routes-oauth.ts:7827`, `server/routes-oauth.ts:8703`, `server/services/email-service.ts:101`, `server/services/email-service.ts:133` |
| MAILGUN_WEBHOOK_SIGNING_KEY | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:33949`, `server/routes-oauth.ts:33957` |
| META_APP_ID | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:24030`, `server/routes-oauth.ts:24162` |
| META_APP_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:24031`, `server/routes-oauth.ts:24163` |
| META_OAUTH_STATE_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:23955`, `server/routes-oauth.ts:23975` |
| META_REFRESH_INTERVAL_HOURS | Server/runtime configuration; deployed value unverified | `server/meta-scheduler.ts:403` |
| META_TEST_MODE | Server/runtime configuration; deployed value unverified | `server/meta-scheduler.ts:329` |
| NODE_ENV | Server/runtime configuration; deployed value unverified | `server/google-auth.ts:24`, `server/index.ts:26`, `server/integrated-ga4-auth.ts:42`, `server/real-ga4-client.ts:50`, `server/report-scheduler.ts:1226`, `server/routes-oauth.ts:809`, `server/routes-oauth.ts:847`, `server/routes-oauth.ts:7759`, `server/routes-oauth.ts:7809`, `server/routes-oauth.ts:8342`, `server/routes-oauth.ts:8472`, `server/routes-oauth.ts:8730`, `server/routes-oauth.ts:14593`, `server/routes-oauth.ts:17461`, `server/routes-oauth.ts:23135`, `server/routes-oauth.ts:24422`, `server/routes-oauth.ts:26646`, `server/routes-oauth.ts:28532`, `server/routes-oauth.ts:28640`, `server/storage.ts:22`, `server/test-support/ga4-recovery-process-worker.ts:11`, `server/utils/tokenVault.ts:57`, `server/utils/tokenVault.ts:80` |
| PORT | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:181`, `server/index.ts:256` |
| RENDER_EXTERNAL_URL | Server/runtime configuration; deployed value unverified | `server/real-ga4-client.ts:48`, `server/routes-oauth.ts:7295`, `server/routes-oauth.ts:10901`, `server/routes-oauth.ts:11000`, `server/routes-oauth.ts:11201`, `server/routes-oauth.ts:11360`, `server/routes-oauth.ts:11401`, `server/routes-oauth.ts:11563`, `server/routes-oauth.ts:11988`, `server/routes-oauth.ts:16372`, `server/routes-oauth.ts:23487`, `server/routes-oauth.ts:23615`, `server/routes-oauth.ts:24043`, `server/routes-oauth.ts:24171`, `server/routes-oauth.ts:26799`, `server/routes-oauth.ts:26864` |
| RENDER_GIT_COMMIT | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:801`, `server/routes-oauth.ts:18660` |
| REPLIT_DOMAIN | Server/runtime configuration; deployed value unverified | `server/real-ga4-client.ts:49`, `server/real-ga4-client.ts:49`, `server/routes-oauth.ts:10902`, `server/routes-oauth.ts:10902`, `server/routes-oauth.ts:11001`, `server/routes-oauth.ts:11001`, `server/routes-oauth.ts:11202`, `server/routes-oauth.ts:11202`, `server/routes-oauth.ts:11361`, `server/routes-oauth.ts:11361`, `server/routes-oauth.ts:11402`, `server/routes-oauth.ts:11402`, `server/routes-oauth.ts:11564`, `server/routes-oauth.ts:11564`, `server/routes-oauth.ts:11989`, `server/routes-oauth.ts:11989`, `server/routes-oauth.ts:16373`, `server/routes-oauth.ts:16373`, `server/routes-oauth.ts:23488`, `server/routes-oauth.ts:23488`, `server/routes-oauth.ts:23616`, `server/routes-oauth.ts:23616`, `server/routes-oauth.ts:24044`, `server/routes-oauth.ts:24044`, `server/routes-oauth.ts:24172`, `server/routes-oauth.ts:24172`, `server/routes-oauth.ts:26800`, `server/routes-oauth.ts:26800`, `server/routes-oauth.ts:26865`, `server/routes-oauth.ts:26865` |
| REPLIT_DOMAINS | Server/runtime configuration; deployed value unverified | `server/google-auth.ts:25` |
| REPORT_SCHEDULER_CRON | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4811` |
| RUN_REPORT_SCHEDULER_ON_STARTUP | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4816` |
| SALESFORCE_API_VERSION | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11623`, `server/routes-oauth.ts:17779`, `server/routes-oauth.ts:18257`, `server/routes-oauth.ts:18309`, `server/routes-oauth.ts:18340`, `server/routes-oauth.ts:18487`, `server/routes-oauth.ts:18747`, `server/routes-oauth.ts:19425` |
| SALESFORCE_AUTH_BASE_URL | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11413`, `server/routes-oauth.ts:11575`, `server/routes-oauth.ts:18631`, `server/routes-oauth.ts:18887`, `server/routes-oauth.ts:20986`, `server/utils/salesforceCurrency.ts:110` |
| SALESFORCE_CLIENT_ID | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11407`, `server/routes-oauth.ts:11569` |
| SALESFORCE_CLIENT_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11570` |
| SALESFORCE_OAUTH_SCOPE | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11416` |
| SALESFORCE_OAUTH_SCOPES | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11416` |
| SALESFORCE_PIPELINE_REFRESH_INTERVAL_MINUTES | Server/runtime configuration; deployed value unverified | `server/auto-refresh-scheduler.ts:97` |
| SENDGRID_API_KEY | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4628`, `server/routes-oauth.ts:7828`, `server/routes-oauth.ts:8704`, `server/services/email-service.ts:103`, `server/services/email-service.ts:125` |
| SENDGRID_WEBHOOK_VERIFICATION_KEY | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:33814`, `server/routes-oauth.ts:33822` |
| SESSION_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:11301`, `server/routes-oauth.ts:23407`, `server/routes-oauth.ts:23427`, `server/routes-oauth.ts:23956`, `server/routes-oauth.ts:23976`, `server/routes-oauth.ts:26644`, `server/utils/tokenVault.ts:31`, `server/utils/tokenVault.ts:74`, `server/utils/tokenVault.ts:159`, `server/utils/tokenVault.ts:165` |
| SHOPIFY_API_VERSION | Server/runtime configuration; deployed value unverified | `server/utils/shopify-provider.ts:16` |
| SHOPIFY_APP_BASE_URL | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:7298` |
| SHOPIFY_CLIENT_ID | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:7302`, `server/routes-oauth.ts:11459`, `server/routes-oauth.ts:11847`, `server/routes-oauth.ts:35625` |
| SHOPIFY_CLIENT_SECRET | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:7303`, `server/routes-oauth.ts:11806`, `server/routes-oauth.ts:35626` |
| SHOPIFY_REDIRECT_URI | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:7284` |
| SHOPIFY_SCOPES | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:7304`, `server/routes-oauth.ts:11460` |
| SMTP_HOST | Server/runtime configuration; deployed value unverified | `server/services/email-service.ts:158` |
| SMTP_PASS | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4629`, `server/routes-oauth.ts:7830`, `server/routes-oauth.ts:8706`, `server/services/email-service.ts:163` |
| SMTP_PORT | Server/runtime configuration; deployed value unverified | `server/services/email-service.ts:159` |
| SMTP_SECURE | Server/runtime configuration; deployed value unverified | `server/services/email-service.ts:160` |
| SMTP_USER | Server/runtime configuration; deployed value unverified | `server/report-scheduler.ts:4629`, `server/services/email-service.ts:162` |
| SNAPSHOT_FREQUENCY | Server/runtime configuration; deployed value unverified | `server/scheduler.ts:868` |
| TIKTOK_REFRESH_INTERVAL_HOURS | Server/runtime configuration; deployed value unverified | `server/tiktok-scheduler.ts:136` |
| TOKEN_ENCRYPTION_KEY | Server/runtime configuration; deployed value unverified | `server/utils/tokenVault.ts:29`, `server/utils/tokenVault.ts:58`, `server/utils/tokenVault.ts:75` |
| TOKEN_ENCRYPTION_SIGNING_SECRET | Server/runtime configuration; deployed value unverified | `server/utils/tokenVault.ts:159`, `server/utils/tokenVault.ts:165` |
| VERCEL_GIT_COMMIT_SHA | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:803` |
| VITE_CLERK_PUBLISHABLE_KEY | Build-time browser setting; Clerk also server fallback | `client/src/main.tsx:6`, `server/index.ts:65`, `server/index.ts:66` |
| VITE_ENABLE_AD_PLATFORM_TEST_MODE | Build-time browser setting; Clerk also server fallback | `client/src/components/AddSpendWizardModal.tsx:33` |
| VITE_ENABLE_SALESFORCE_REVENUE_SOURCE | Build-time browser setting; Clerk also server fallback | `client/src/components/AddRevenueWizardModal.tsx:23` |
| YESOP_ANCHOR_DATE_UTC | Server/runtime configuration; deployed value unverified | `server/routes-oauth.ts:968` |

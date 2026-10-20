// Run only against the existing, isolated loopback fixture. Never loads .env.
const fs = require("node:fs"), ts = require("typescript"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const { Pool } = require("pg"), { drizzle } = require("drizzle-orm/node-postgres"), orm = require("drizzle-orm");
const { getTableConfig } = require("drizzle-orm/pg-core");
assert.equal(process.env.DATABASE_URL || "", "", "Do not inherit an application database URL");
const url = new URL(process.env.V1_BATCH1_TEST_DATABASE_URL || "");
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55443"); assert.equal(url.pathname, "/notifications_test");
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const schema = {}, vault = {}, fixtureEnv = { env: { NODE_ENV: "production", TOKEN_ENCRYPTION_KEY: "batch1-fixture-key", SERVICE_ACCOUNT_RESOURCE_GRANTS: "[]" } };
new Function("exports", "require", compile(fs.readFileSync("shared/schema.ts", "utf8")))(schema, require);
new Function("exports", "require", "process", compile(fs.readFileSync("server/utils/tokenVault.ts", "utf8")))(vault, require, fixtureEnv);
const source = ts.createSourceFile("storage.ts", fs.readFileSync("server/storage.ts", "utf8"), ts.ScriptTarget.Latest, true);
const methods = new Map(); let hydrate;
function visit(n) {
  if (ts.isMethodDeclaration(n)) methods.set(n.name.getText(source), n.getText(source));
  if (ts.isFunctionDeclaration(n) && n.name?.text === "hydrateDecryptedTokens") hydrate = n.getText(source);
  ts.forEachChild(n, visit);
}
visit(source);
const names = ["getCampaign", "createCampaign", "getMetrics", "createMetric", "getPerformanceData", "createPerformanceData", "getIntegrations", "createIntegration",
  "getCustomIntegration", "createCustomIntegration", "createCustomIntegrationMetrics", "createConversionEvent", "replaceSpendSourceWithRecords", "assertServiceAccountResourceAccess",
  "getAttributionModels", "getAttributionModel", "createAttributionModel", "updateAttributionModel", "deleteAttributionModel", "setDefaultAttributionModel",
  "getCustomerJourneys", "getCustomerJourney", "createCustomerJourney", "updateCustomerJourney", "deleteCustomerJourney", "getJourneyTouchpoints", "getCampaignTouchpoints",
  "createTouchpoint", "updateTouchpoint", "deleteTouchpoint", "getAttributionResults", "calculateAttributionResults", "getChannelPerformanceAttribution",
  "updateMetaKPI", "updateMetaBenchmark", "updateLinkedInConnection"];
function storageFor(db, selected = names) {
  const env = { ...schema, ...orm, ...vault, db, process: fixtureEnv, randomUUID: crypto.randomUUID,
    hydrateGoogleSheetsConnectionForRead: async r => r, hydrateGA4ServiceAccountConnection: async r => r };
  return new Function(...Object.keys(env), compile(hydrate + "\nclass FixtureStorage {\n" + selected.map(n => { assert.ok(methods.has(n), n); return methods.get(n); }).join("\n") + "\n}\nreturn new FixtureStorage();"))(...Object.values(env));
}
const admin = new Pool({ connectionString: url.href, max: 1 });
const fixtureSchema = "v1_batch1_" + crypto.randomUUID().replaceAll("-", "");
assert.match(fixtureSchema, /^v1_batch1_[a-f0-9]{32}$/);
const pool = new Pool({ connectionString: url.href, options: `-c search_path=${fixtureSchema}`, max: 6, statement_timeout: 15000, lock_timeout: 10000 });
const db = drizzle(pool), store = storageFor(db), results = [];
async function check(name, run) { await run(); results.push({ name, result: "PASS" }); }
async function row(table, overrides) {
  const values = {};
  for (const [key, column] of Object.entries(orm.getTableColumns(table))) {
    if (!column.notNull || column.default !== undefined || column.defaultFn) continue;
    values[key] = column.getSQLType().startsWith("numeric") ? "1" : column.dataType === "number" ? 1 : column.dataType === "boolean" ? false : column.dataType === "date" ? new Date() :
      column.dataType === "json" ? {} : column.dataType === "array" ? [] : "fixture";
  }
  return (await db.insert(table).values({ ...values, ...overrides }).returning())[0];
}
(async () => {
  try {
    await admin.query(`CREATE SCHEMA "${fixtureSchema}"`);
    const baseline = JSON.parse(fs.readFileSync("docs/audits/v1-2026-10-19/schema-generation.json", "utf8"));
    for (const statement of baseline.statements) { assert.ok(!/(?:"public"|\bpublic)\s*\./i.test(statement)); await pool.query(statement); }
    const migration = fs.readFileSync("migrations/0022_v1_entrypoint_ownership.sql", "utf8");
    const grantsMigration = fs.readFileSync("migrations/0023_service_account_resource_grants.sql", "utf8");
    await check("0022 upgrade and repeated application preserve unowned rows", async () => {
      await pool.query("INSERT INTO metrics(name,value,change,icon) VALUES ('legacy','1','0','fixture')");
      await pool.query(migration); await pool.query(migration);
      assert.equal((await pool.query("SELECT owner_id FROM metrics WHERE name='legacy'")).rows[0].owner_id, null);
    });
    await check("0023 upgrade and repeated application create an empty grant table", async () => {
      await pool.query(grantsMigration); await pool.query(grantsMigration);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM service_account_resource_grants")).rows[0].n, 0);
    });
    await row(schema.clients, { id: "client-a", ownerId: "owner-a", name: "Fixture client A" });
    await row(schema.clients, { id: "client-b", ownerId: "owner-b", name: "Fixture client B" });
    await row(schema.campaigns, { id: "campaign-a", ownerId: "owner-a", clientId: "client-a", name: "Fixture A", currency: "EUR" });
    await row(schema.campaigns, { id: "campaign-b", ownerId: "owner-b", clientId: "client-b", name: "Fixture B", currency: "USD" });
    await check("global entries enforce query ownership and redact encrypted credentials", async () => {
      await store.createMetric({ name: "A", value: "1", change: "0", icon: "fixture" }, "owner-a");
      await store.createMetric({ name: "B", value: "2", change: "0", icon: "fixture" }, "owner-b");
      assert.deepEqual((await store.getMetrics("owner-a")).map(r => r.name), ["A"]);
      await store.createPerformanceData({ date: "2026-10-19", impressions: 2, clicks: 1, conversions: 0 }, "owner-a");
      assert.equal((await store.getPerformanceData("owner-b")).length, 0);
      const saved = await store.createIntegration({ name: "A", platform: "fixture", credentials: "fixture-private-key", connected: true }, "owner-a");
      assert.equal(saved.credentials, null); assert.equal(saved.connected, false);
      const persisted = (await db.select().from(schema.integrations))[0];
      assert.ok(!persisted.credentials.includes("fixture-private-key"));
      assert.equal(vault.decryptString(JSON.parse(persisted.credentials)), "fixture-private-key");
      assert.equal((await store.getIntegrations("owner-b")).length, 0);
      assert.equal((await store.getIntegrations("owner-a"))[0].credentials, null);
    });
    const integration = await store.createCustomIntegration({ campaignId: "campaign-a", webhookToken: "fixture-current-token", email: "fixture@example.invalid", allowedEmailAddresses: ["old@example.invalid"] });
    await check("whitelist changes persist, explicit empty clears and omitted preserves", async () => {
      await store.createCustomIntegration({ campaignId: "campaign-a", webhookToken: "fixture-current-token", email: integration.email, allowedEmailAddresses: ["new@example.invalid"] });
      assert.deepEqual((await store.getCustomIntegration("campaign-a")).allowedEmailAddresses, ["new@example.invalid"]);
      await store.createCustomIntegration({ campaignId: "campaign-a", webhookToken: "fixture-current-token", email: integration.email });
      assert.deepEqual((await store.getCustomIntegration("campaign-a")).allowedEmailAddresses, ["new@example.invalid"]);
      await store.createCustomIntegration({ campaignId: "campaign-a", webhookToken: "fixture-current-token", email: integration.email, allowedEmailAddresses: [] });
      assert.deepEqual((await store.getCustomIntegration("campaign-a")).allowedEmailAddresses, []);
      await store.createCustomIntegration({ campaignId: "campaign-a", webhookToken: "fixture-current-token", email: integration.email, allowedEmailAddresses: ["new@example.invalid"] });
    });
    const access = { integrationId: integration.id, webhookToken: "fixture-current-token", receipt: "mailgun:fixture-receipt", senderEmail: "new@example.invalid" };
    await check("concurrent replay writes once; receipts survive new storage instances and metric deletion", async () => {
      const writes = await Promise.all(Array.from({ length: 5 }, () => store.createCustomIntegrationMetrics({ campaignId: "campaign-a", users: 3 }, access)));
      assert.equal(new Set(writes.map(w => w.id)).size, 1);
      assert.equal(writes.filter(w => !w.alreadyProcessed).length, 1);
      assert.equal((await storageFor(db).createCustomIntegrationMetrics({ campaignId: "campaign-a", users: 999 }, access)).alreadyProcessed, true);
      await db.delete(schema.customIntegrationMetrics).where(orm.eq(schema.customIntegrationMetrics.id, writes[0].id));
      await assert.rejects(store.createCustomIntegrationMetrics({ campaignId: "campaign-a", users: 999 }, access), /already processed/);
    });
    await check("removed senders, rotated tokens and missing parents cannot publish", async () => {
      await assert.rejects(store.createCustomIntegrationMetrics({ campaignId: "campaign-a" }, { ...access, receipt: "new-1", senderEmail: "old@example.invalid" }), /Sender access revoked/);
      await assert.rejects(store.createCustomIntegrationMetrics({ campaignId: "campaign-a" }, { ...access, receipt: "new-2", webhookToken: "old-token" }), /access revoked/);
      await assert.rejects(store.createCustomIntegrationMetrics({ campaignId: "missing" }, access), /Campaign unavailable/);
      assert.equal((await db.select().from(schema.customIntegrationMetrics)).length, 0);
      assert.equal((await db.select().from(schema.inboundWebhookReceipts)).length, 1);
    });
    await check("conversion zero, duplicate concurrency, currency filtering and atomic average", async () => {
      await row(schema.conversionEvents, { campaignId: "campaign-a", value: "9000", currency: "USD", source: "historical-fixture" });
      const event = { campaignId: "campaign-a", conversionId: "order-a", value: "0.00", currency: "EUR", source: "webhook", occurredAt: new Date() };
      const writes = await Promise.all([store.createConversionEvent(event, { ownerId: "owner-a" }), store.createConversionEvent(event, { ownerId: "owner-a" })]);
      assert.equal(writes[0].id, writes[1].id);
      await store.createConversionEvent({ ...event, conversionId: "order-b", value: "20.00" }, { ownerId: "owner-a" });
      assert.equal((await store.getCampaign("campaign-a")).conversionValue, "10.00");
      await assert.rejects(store.createConversionEvent({ ...event, conversionId: "wrong", currency: "USD" }, { ownerId: "owner-a" }), /currency mismatch/);
      await assert.rejects(store.createConversionEvent({ ...event, conversionId: "foreign" }, { ownerId: "owner-b" }), /unavailable/);
      await assert.rejects(store.createConversionEvent({ ...event, conversionId: "revoked" }, { ownerId: "owner-a", webhookToken: "old-token" }), /revoked/);
      assert.equal((await db.select().from(schema.conversionEvents)).length, 3);
    });
    await check("connector source/records commit atomically and foreign source/currency are rejected", async () => {
      const sourceData = { campaignId: "campaign-a", sourceType: "connector_derived", platformContext: "google_sheets", displayName: "Fixture spend", currency: "EUR", isActive: true };
      const records = [{ campaignId: "campaign-a", date: "2026-10-19", spend: "12.00", currency: "EUR", sourceType: "connector_derived" }];
      const source = await store.replaceSpendSourceWithRecords("campaign-a", null, "connector_derived", "google_sheets", sourceData, records);
      await assert.rejects(store.replaceSpendSourceWithRecords("campaign-b", source.id, "connector_derived", "google_sheets", { ...sourceData, currency: "USD" }, []));
      await assert.rejects(store.replaceSpendSourceWithRecords("campaign-a", source.id, "connector_derived", "google_sheets", sourceData, [{ ...records[0], spend: "not-a-number" }]));
      assert.equal((await db.select().from(schema.spendRecords))[0].spend, "12.00");
      await assert.rejects(store.replaceSpendSourceWithRecords("missing", null, "connector_derived", "google_sheets", sourceData, records));
    });
    await check("shared resource grants bind owner, client, provider and resource and revoke immediately", async () => {
      fixtureEnv.env.SERVICE_ACCOUNT_RESOURCE_GRANTS = JSON.stringify([{ ownerId: "owner-a", clientId: "client-a", provider: "ga4", resourceId: "123" }]);
      await store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123");
      for (const args of [["campaign-b", "ga4", "123"], ["campaign-a", "ga4", "456"], ["campaign-a", "google_ads", "123"], ["missing", "ga4", "123"]]) await assert.rejects(store.assertServiceAccountResourceAccess(...args), /not approved/);
      fixtureEnv.env.SERVICE_ACCOUNT_RESOURCE_GRANTS = "[]";
      await assert.rejects(store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123"), /not approved/);
      fixtureEnv.env.SERVICE_ACCOUNT_RESOURCE_GRANTS = JSON.stringify([{ ownerId: "owner-a", clientId: "client-b", provider: "ga4", resourceId: "123" }]);
      await db.update(schema.campaigns).set({ clientId: "client-b" }).where(orm.eq(schema.campaigns.id, "campaign-a"));
      await assert.rejects(store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123"), /not approved/);
      await db.update(schema.campaigns).set({ clientId: "client-a" }).where(orm.eq(schema.campaigns.id, "campaign-a"));
      fixtureEnv.env.SERVICE_ACCOUNT_RESOURCE_GRANTS = "invalid-json";
      await assert.rejects(store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123"), /not approved/);
    });
    await check("database grant preserves approved access without any Render grant setting", async () => {
      delete fixtureEnv.env.SERVICE_ACCOUNT_RESOURCE_GRANTS;
      await pool.query("INSERT INTO service_account_resource_grants(owner_id,client_id,provider,resource_id) VALUES ('owner-a','client-a','ga4','123')");
      await store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123");
      const restarted = storageFor(drizzle(pool));
      await restarted.assertServiceAccountResourceAccess("campaign-a", "ga4", "123");
    });
    await check("database grant rejects foreign owner, client, provider, property and missing campaign", async () => {
      await row(schema.clients, { id: "client-a2", ownerId: "owner-a", name: "Other owned client" });
      await row(schema.campaigns, { id: "campaign-a2", ownerId: "owner-a", clientId: "client-a2", name: "Other owned campaign" });
      for (const args of [["campaign-b", "ga4", "123"], ["campaign-a2", "ga4", "123"], ["campaign-a", "ga4", "456"], ["campaign-a", "google_ads", "123"], ["campaign-a", "google_sheets", "123"], ["missing", "ga4", "123"]]) {
        await assert.rejects(store.assertServiceAccountResourceAccess(...args), /not approved/);
      }
    });
    await check("database grant does not survive changed campaign/client ownership or deletion status", async () => {
      for (const change of [{ ownerId: "owner-b" }, { clientId: "client-a2" }, { status: "deleted" }]) {
        await db.update(schema.campaigns).set(change).where(orm.eq(schema.campaigns.id, "campaign-a"));
        await assert.rejects(store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123"), /not approved/);
        await db.update(schema.campaigns).set({ ownerId: "owner-a", clientId: "client-a", status: "active" }).where(orm.eq(schema.campaigns.id, "campaign-a"));
      }
      await db.update(schema.clients).set({ ownerId: "owner-b" }).where(orm.eq(schema.clients.id, "client-a"));
      await assert.rejects(store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123"), /not approved/);
      await db.update(schema.clients).set({ ownerId: "owner-a" }).where(orm.eq(schema.clients.id, "client-a"));
    });
    await check("database grants enforce exact uniqueness and immediate revocation across storage instances", async () => {
      await assert.rejects(pool.query("INSERT INTO service_account_resource_grants(owner_id,client_id,provider,resource_id) VALUES ('owner-a','client-a','ga4','123')"), { code: "23505" });
      await pool.query("DELETE FROM service_account_resource_grants WHERE owner_id='owner-a' AND client_id='client-a' AND provider='ga4' AND resource_id='123'");
      await assert.rejects(store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123"), /not approved/);
      await assert.rejects(storageFor(drizzle(pool)).assertServiceAccountResourceAccess("campaign-a", "ga4", "123"), /not approved/);
    });
    await check("client deletion cascades only that client's stored grants", async () => {
      await pool.query("INSERT INTO service_account_resource_grants(owner_id,client_id,provider,resource_id) VALUES ('owner-a','client-a2','ga4','123'),('owner-b','client-b','ga4','456')");
      await db.delete(schema.clients).where(orm.eq(schema.clients.id, "client-a2"));
      const remaining = (await pool.query("SELECT owner_id,client_id,provider,resource_id FROM service_account_resource_grants")).rows;
      assert.deepEqual(remaining, [{ owner_id: "owner-b", client_id: "client-b", provider: "ga4", resource_id: "456" }]);
      await assert.rejects(store.assertServiceAccountResourceAccess("campaign-a2", "ga4", "123"), /not approved/);
      await store.assertServiceAccountResourceAccess("campaign-b", "ga4", "456");
      await pool.query("DELETE FROM service_account_resource_grants WHERE client_id='client-b'");
    });
    await check("legacy updates preserve campaign and row identity while saving allowed fields", async () => {
      for (const [table, method] of [[schema.metaKpis, "updateMetaKPI"], [schema.metaBenchmarks, "updateMetaBenchmark"]]) {
        const previous = await row(table, { campaignId: "campaign-a", name: "Before" });
        const updated = await store[method](previous.id, { id: "moved", campaignId: "campaign-b", name: "After" });
        assert.equal(updated.id, previous.id); assert.equal(updated.campaignId, "campaign-a"); assert.equal(updated.name, "After");
      }
      const previous = await row(schema.linkedinConnections, { campaignId: "campaign-a", adAccountName: "Before", encryptedTokens: null });
      store.writeGA4RefreshInputChange = (_campaignId, write) => db.transaction(write);
      const updated = await store.updateLinkedInConnection("campaign-a", { id: "moved", campaignId: "campaign-b", adAccountName: "After" });
      assert.equal(updated.id, previous.id); assert.equal(updated.campaignId, "campaign-a"); assert.equal(updated.adAccountName, "After");
    });
    await check("attribution persists across instances, scopes owners and keeps calculated rows durable", async () => {
      const a = await store.createAttributionModel({ name: "Linear A", type: "linear" }, "owner-a");
      const b = await store.createAttributionModel({ name: "Linear B", type: "linear" }, "owner-b");
      const journey = await store.createCustomerJourney({ customerId: "fixture", journeyStart: new Date(), conversionValue: "30.00" }, "owner-a");
      await store.createTouchpoint({ journeyId: journey.id, campaignId: "campaign-a", channel: "email", touchpointType: "click", position: 1, timestamp: new Date() });
      await assert.rejects(store.createTouchpoint({ journeyId: journey.id, campaignId: "campaign-b", channel: "email", touchpointType: "click", position: 2, timestamp: new Date() }), /Campaign unavailable/);
      assert.deepEqual((await storageFor(db).getAttributionModels("owner-b")).map(r => r.id), [b.id]);
      assert.equal((await storageFor(db).getCustomerJourneys(undefined, "owner-b")).length, 0);
      assert.equal((await store.calculateAttributionResults(journey.id, b.id)).length, 0);
      assert.equal((await store.calculateAttributionResults(journey.id, a.id))[0].attributedValue, "30");
      assert.equal((await storageFor(db).getAttributionResults(journey.id, a.id)).length, 1);
      assert.equal((await store.getChannelPerformanceAttribution(new Date(0), new Date(), undefined, "owner-b")).length, 0);
      await store.setDefaultAttributionModel(a.id); await store.setDefaultAttributionModel(b.id);
      assert.equal((await store.getAttributionModel(a.id)).isDefault, true);
      await store.deleteCustomerJourney(journey.id);
      assert.equal((await store.getJourneyTouchpoints(journey.id)).length, 0);
      assert.equal((await store.getAttributionResults(journey.id)).length, 0);
    });
    await check("attribution calculation/deletion races cannot leave orphaned results or touchpoints", async () => {
      for (const deletion of ["model", "journey", "touchpoint"]) {
        const model = await store.createAttributionModel({ name: "Race", type: "linear" }, "owner-a");
        const journey = await store.createCustomerJourney({ customerId: "race", journeyStart: new Date(), conversionValue: "10" }, "owner-a");
        const point = await store.createTouchpoint({ journeyId: journey.id, campaignId: "campaign-a", channel: "email", touchpointType: "click", position: 1, timestamp: new Date() });
        await Promise.all([
          store.calculateAttributionResults(journey.id, model.id),
          deletion === "model" ? store.deleteAttributionModel(model.id) : deletion === "journey" ? store.deleteCustomerJourney(journey.id) : store.deleteTouchpoint(point.id),
        ]);
        assert.equal((await store.getAttributionResults(journey.id, model.id)).length, 0);
        if (deletion === "journey") assert.equal((await store.getJourneyTouchpoints(journey.id)).length, 0);
      }
    });
    await check("campaign touchpoint reads exclude inconsistent persisted journey ownership", async () => {
      const journey = await store.createCustomerJourney({ customerId: "foreign", journeyStart: new Date() }, "owner-b");
      const point = await row(schema.touchpoints, { journeyId: journey.id, campaignId: "campaign-a", channel: "email", timestamp: new Date() });
      assert.ok(!(await store.getCampaignTouchpoints("campaign-a")).some(r => r.id === point.id));
    });
    const tokenCases = [["getGoogleSheetsConnections", "googleSheetsConnections"], ["getHubspotConnections", "hubspotConnections"], ["getHubspotConnection", "hubspotConnections"],
      ["getSalesforceConnections", "salesforceConnections"], ["getSalesforceConnection", "salesforceConnections"], ["getShopifyConnections", "shopifyConnections"],
      ["getShopifyConnection", "shopifyConnections"], ["getLinkedInConnection", "linkedinConnections"], ["getMetaConnection", "metaConnections"], ["getGoogleAdsConnection", "googleAdsConnections"]];
    for (const [method, tableName] of tokenCases) await check(`${method}: concurrent renewal survives lazy encryption CAS`, async () => {
      const table = schema[tableName], tableConfig = getTableConfig(table);
      await db.delete(table);
      const previous = await row(table, { campaignId: "campaign-a", method: "access_token", mappingConfig: "{}", isActive: true, accessToken: "fixture-old", refreshToken: "fixture-old-refresh", clientSecret: null, encryptedTokens: null });
      const rotated = vault.buildEncryptedTokens({ accessToken: "fixture-renewed", refreshToken: "fixture-renewed-refresh" });
      let interleaved = false;
      const racingDb = new Proxy(db, { get(target, key) {
        if (key !== "update") return typeof target[key] === "function" ? target[key].bind(target) : target[key];
        return targetTable => ({ set: values => ({ where: async predicate => {
          assert.equal(targetTable, table);
          interleaved = true;
          await db.update(table).set({ encryptedTokens: rotated, accessToken: null }).where(orm.eq(table.id, previous.id));
          return db.update(table).set(values).where(predicate);
        } }) });
      } });
      await storageFor(racingDb, [method])[method]("campaign-a");
      assert.equal(interleaved, true, tableConfig.name);
      const persisted = (await db.select().from(table))[0];
      assert.equal(vault.decryptTokens(persisted.encryptedTokens).accessToken, "fixture-renewed");
    });
    const { applyReviewedGrant } = require("../docs/fixes/v1-batch-1/apply-reviewed-resource-grant.cjs");
    const approved = { ownerId: "owner-a", clientId: "client-a", provider: "ga4", resourceId: "123" };
    await row(schema.ga4Connections, { campaignId: "campaign-a", method: "service_account", propertyId: "123", isActive: true });
    const deploymentClient = await pool.connect();
    try {
      await check("reviewed deployment dry-run rolls back its permission write", async () => {
        const result = await applyReviewedGrant(deploymentClient, approved, { campaignName: "Fixture A" });
        assert.equal(result.committed, false); assert.equal(result.rolledBack, true);
        assert.equal((await pool.query("SELECT count(*)::int AS n FROM service_account_resource_grants")).rows[0].n, 0);
      });
      await check("reviewed deployment refuses wrong owner, client, resource, provider or missing campaign", async () => {
        for (const change of [{ ownerId: "owner-b" }, { clientId: "client-b" }, { resourceId: "999" }, { provider: "google_ads" }]) {
          await assert.rejects(applyReviewedGrant(deploymentClient, { ...approved, ...change }, { campaignName: "Fixture A", apply: true }));
        }
        await assert.rejects(applyReviewedGrant(deploymentClient, approved, { campaignName: "missing", apply: true }));
        assert.equal((await pool.query("SELECT count(*)::int AS n FROM service_account_resource_grants")).rows[0].n, 0);
      });
      await check("reviewed deployment refuses ambiguous or OAuth-only connections", async () => {
        const extra = await row(schema.ga4Connections, { campaignId: "campaign-a", method: "service_account", propertyId: "123", isActive: true });
        await assert.rejects(applyReviewedGrant(deploymentClient, approved, { campaignName: "Fixture A", apply: true }));
        await db.delete(schema.ga4Connections).where(orm.eq(schema.ga4Connections.id, extra.id));
        await pool.query("UPDATE ga4_connections SET method='access_token' WHERE campaign_id='campaign-a'");
        await assert.rejects(applyReviewedGrant(deploymentClient, approved, { campaignName: "Fixture A", apply: true }));
        await pool.query("UPDATE ga4_connections SET method='service_account' WHERE campaign_id='campaign-a'");
      });
      await check("reviewed deployment rolls back a failed permission insert", async () => {
        await pool.query("ALTER TABLE service_account_resource_grants ADD CONSTRAINT fixture_reject_insert CHECK (resource_id<>'123')");
        await assert.rejects(applyReviewedGrant(deploymentClient, approved, { campaignName: "Fixture A", apply: true }), { code: "23514" });
        assert.equal((await pool.query("SELECT count(*)::int AS n FROM service_account_resource_grants")).rows[0].n, 0);
        await pool.query("ALTER TABLE service_account_resource_grants DROP CONSTRAINT fixture_reject_insert");
      });
      await check("reviewed deployment commits exactly one permission idempotently without changing customer records", async () => {
        async function records() {
          const saved = [];
          for (const table of ['clients','campaigns','ga4_connections']) saved.push((await pool.query(`SELECT json_agg(t ORDER BY id) AS data FROM ${table} t`)).rows);
          return saved;
        }
        const before = await records();
        const first = await applyReviewedGrant(deploymentClient, approved, { campaignName: "Fixture A", apply: true });
        assert.equal(first.committed, true); assert.equal(first.grantsInserted, 1);
        const second = await applyReviewedGrant(deploymentClient, approved, { campaignName: "Fixture A", apply: true });
        assert.equal(second.committed, true); assert.equal(second.grantsInserted, 0);
        assert.equal((await pool.query("SELECT count(*)::int AS n FROM service_account_resource_grants")).rows[0].n, 1);
        assert.deepEqual(await records(), before);
        await store.assertServiceAccountResourceAccess("campaign-a", "ga4", "123");
      });
    } finally { deploymentClient.release(); }
    await check("fresh current schema and repeated 0022/0023 migrations agree on ownership, receipts and grants", async () => {
      const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api");
      const current = generateDrizzleJson(schema), statements = await generateMigration(generateDrizzleJson({}), current);
      assert.equal(Object.keys(current.tables).length, 64);
      assert.match(fixtureSchema, /^v1_batch1_[a-f0-9]{32}$/);
      await admin.query(`DROP SCHEMA "${fixtureSchema}" CASCADE`);
      await admin.query(`CREATE SCHEMA "${fixtureSchema}"`);
      for (const statement of statements) {
        const scoped = statement.replace('REFERENCES "public"."clients"', 'REFERENCES "clients"');
        assert.ok(!/(?:"public"|\bpublic)\s*\./i.test(scoped)); await pool.query(scoped);
      }
      await pool.query(migration);
      await pool.query(grantsMigration);
      for (const table of ["metrics", "integrations", "performance_data", "attribution_models", "customer_journeys"]) {
        const index = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname=$2", [fixtureSchema, `${table}_owner_id_idx`]);
        assert.equal(index.rows.length, 1);
      }
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM inbound_webhook_receipts")).rows[0].n, 0);
    });
    fs.writeFileSync("docs/fixes/v1-batch-1/database-grants-postgres.json", JSON.stringify({ at: new Date().toISOString(), base: "2fcee885", boundary: "Exact current storage methods, real PostgreSQL isolated schema; no provider calls or production state", results }, null, 2) + "\n");
    console.log(`${results.length} PostgreSQL checks passed`);
  } finally {
    await pool.end();
    assert.match(fixtureSchema, /^v1_batch1_[a-f0-9]{32}$/);
    await admin.query(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await admin.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import ts from "typescript";

function readRoutesSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
}

function readStorageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "storage.ts"), "utf8");
}

function readSchemaSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "shared", "schema.ts"), "utf8");
}

describe("campaign/client delete cascade regression guards", () => {
  it("requires campaign access before campaign cascade deletion", () => {
    const source = readRoutesSource();
    const routeStart = source.indexOf('app.delete("/api/campaigns/:id"');
    const routeEnd = source.indexOf("// GA4 daily metrics", routeStart);
    const route = source.slice(routeStart, routeEnd);

    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.deleteCampaignCascade(campaignId)"));
  });

  it("cleans campaign-scoped report send events without touching another campaign's live report", () => {
    const source = readStorageSource();
    const methodStart = source.indexOf("private async deleteCampaignChildren");
    const methodEnd = source.indexOf("async deleteCampaignCascade", methodStart);
    const method = source.slice(methodStart, methodEnd);

    expect(method).toContain("DELETE FROM report_send_events");
    expect(method).toContain("FROM report_snapshots WHERE campaign_id = ${campaignId}");
    expect(method).toContain("COALESCE(linkedin_reports.campaign_id, '') <> ${campaignId}");
    expect(method).toContain("kpi_reports.campaign_id <> ${campaignId}");
    expect(method.indexOf("DELETE FROM report_send_events")).toBeLessThan(method.indexOf("await tx.delete(reportSnapshots).where(eq(reportSnapshots.campaignId, campaignId))"));
  });

  it("covers every direct campaign-scoped schema table in campaign child cleanup", () => {
    const schema = readSchemaSource();
    const storage = readStorageSource();
    const methodStart = storage.indexOf("private async deleteCampaignChildren");
    const methodEnd = storage.indexOf("async deleteCampaignCascade", methodStart);
    const method = storage.slice(methodStart, methodEnd);
    const parsed = ts.createSourceFile("schema.ts", schema, ts.ScriptTarget.Latest, true);
    const campaignScopedTables: { symbol: string; tableName: string }[] = [];
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
        && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(parsed) === "pgTable") {
        const [name, columns] = node.initializer.arguments;
        if (node.name.text !== "campaigns" && ts.isStringLiteral(name) && ts.isObjectLiteralExpression(columns)
          && columns.properties.some(column => column.name?.getText(parsed) === "campaignId"))
          campaignScopedTables.push({ symbol: node.name.text, tableName: name.text });
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);

    expect(campaignScopedTables.length).toBeGreaterThan(20);
    for (const { symbol, tableName } of campaignScopedTables) {
      if (symbol === "inboundWebhookReceipts") {
        // Receipt tombstones must outlive deleted metrics/campaigns to reject
        // replays after deletion or an attempted reuse of the same identifier.
        expect(method).not.toContain("tx.delete(inboundWebhookReceipts)");
      } else if (symbol === "notifications") {
        expect(method).toContain("tx.update(notifications)");
      } else if (["ga4RefreshWork", "metaKpis", "metaBenchmarks", "metaReports", "ga4GoogleAdsSpendConnections", "ga4GoogleAdsSpendDailyMetrics"].includes(symbol)) {
        expect(method).toContain(`deleteOptionalCampaignTable("${tableName}")`);
      } else {
        expect(method).toContain(`tx.delete(${symbol}).where(eq(${symbol}.campaignId, campaignId))`);
      }
    }
  });

  it("keeps client deletion transactional and reuses the campaign child cleanup", () => {
    const source = readStorageSource();
    const methodStart = source.indexOf("async deleteClientCascade");
    const methodEnd = source.indexOf("// A/B Test methods", methodStart);
    const method = source.slice(methodStart, methodEnd);

    expect(method).toContain("eq(clients.ownerId, ownerId)");
    expect(method).toContain("Refusing to delete client");
    expect(method).toContain("COALESCE(${campaigns.ownerId}, '') NOT IN (${ownerId}, '')");
    expect(method.indexOf("Refusing to delete client")).toBeLessThan(method.indexOf("await db.transaction"));
    expect(method).toContain("await db.transaction");
    expect(method).toContain("await this.deleteCampaignChildren(String(campaign.id), tx)");
    expect(method).toContain("await tx.delete(campaigns).where(eq(campaigns.id, String(campaign.id)))");
    expect(method).toContain("await tx.delete(clients).where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId)))");
  });
});

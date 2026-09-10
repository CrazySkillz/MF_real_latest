import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync("server/routes-oauth.ts", "utf8");

const sliceBetween = (start: string, end: string) => {
  const startIndex = routes.indexOf(start);
  const endIndex = routes.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return routes.slice(startIndex, endIndex);
};

describe("Salesforce Pipeline Proxy stage safety", () => {
  it("offers only active open Salesforce stages", () => {
    const stageRoute = sliceBetween(
      "const fetchOpenSalesforceOpportunityStages",
      "// Salesforce Opportunity unique values",
    );

    expect(stageRoute).toContain("FROM OpportunityStage WHERE IsActive = true AND IsClosed = false");
    expect(stageRoute).toContain("fetchOpenSalesforceOpportunityStages(accessToken, instanceUrl, version)");
    expect(stageRoute).not.toContain("picklistValues");
  });

  it("rejects a closed or inactive stage before saving revenue changes", () => {
    const saveRoute = sliceBetween(
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
      "// Salesforce pipeline proxy status",
    );
    const validationIndex = saveRoute.indexOf("openStageNames.has(pipelineStageName)");
    const replacementIndex = saveRoute.indexOf("replaceGa4SalesforceRevenueSourceWithRecords");

    expect(validationIndex).toBeGreaterThanOrEqual(0);
    expect(replacementIndex).toBeGreaterThan(validationIndex);
    expect(saveRoute).toContain("Pipeline Proxy requires an active open Salesforce stage.");
  });

  it("excludes closed opportunities from every pipeline count and total query", () => {
    const uniqueValuesRoute = sliceBetween(
      "// Salesforce Opportunity unique values",
      "// Salesforce Opportunity preview",
    );
    const previewRoute = sliceBetween(
      "// Salesforce Opportunity preview",
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
    );
    const saveRoute = sliceBetween(
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
      "// Salesforce pipeline proxy status",
    );
    const pipelineRoute = sliceBetween(
      "// Salesforce pipeline proxy status",
      "// HubSpot pipeline proxy status",
    );

    expect(uniqueValuesRoute.match(/StageName = '\$\{escapedStage\}' AND IsClosed = false/g)).toHaveLength(2);
    expect(previewRoute).toContain("StageName = '${escapedStage}' AND IsClosed = false");
    expect(saveRoute).toContain("StageName = '${escapedStage}' AND IsClosed = false");
    expect(pipelineRoute).toContain("StageName = '${escapedStage}' AND IsClosed = false");
  });
});

import { describe, expect, it } from "vitest";
import { clearGa4CrmPipelineProxyMapping } from "./routes-oauth";

const sourceConfig = {
  platformContext: "ga4",
  selectedValues: ["Beacon Analytics Package", "Delta Enterprise Evaluation", "Acme Expansion"],
  campaignMappings: [
    { crmValue: "Beacon Analytics Package", linkedinCampaignUrn: "yesop_paid_social" },
    { crmValue: "Delta Enterprise Evaluation", linkedinCampaignUrn: "yesop_paid_social" },
    { crmValue: "Acme Expansion", linkedinCampaignUrn: "yesop_paid_social" },
  ],
  campaignValueRevenueTotals: [{ campaignValue: "Beacon Analytics Package", revenue: 75 }],
  pipelineEnabled: true,
  pipelineStageLabel: "Prospecting",
  pipelineTotalToDate: 251,
  pipelineValueRevenueTotals: [
    { campaignValue: "Delta Enterprise Evaluation", revenue: 101 },
    { campaignValue: "Acme Expansion", revenue: 150 },
  ],
};

describe("CRM Pipeline Proxy mapping removal", () => {
  it.each([
    ["salesforce", "pipelineStageName"],
    ["hubspot", "pipelineStageId"],
  ] as const)("removes %s proxy-only selections while preserving confirmed revenue selection", (sourceType, stageField) => {
    const result = clearGa4CrmPipelineProxyMapping({ ...sourceConfig, [stageField]: "open-stage" }, sourceType);

    expect(result.selectedValues).toEqual(["Beacon Analytics Package"]);
    expect(result.campaignMappings).toEqual([
      { crmValue: "Beacon Analytics Package", linkedinCampaignUrn: "yesop_paid_social" },
    ]);
    expect(result.campaignValueRevenueTotals).toEqual(sourceConfig.campaignValueRevenueTotals);
    expect(result.pipelineEnabled).toBe(false);
    expect(result[stageField]).toBeNull();
    expect(result.pipelineValueRevenueTotals).toEqual([]);
    expect(result.pipelineTotalToDate).toBe(0);
  });

  it("retains a value that contributes to both confirmed revenue and Pipeline Proxy", () => {
    const result = clearGa4CrmPipelineProxyMapping({
      ...sourceConfig,
      selectedValues: ["Beacon Analytics Package"],
      pipelineValueRevenueTotals: [{ campaignValue: "Beacon Analytics Package", revenue: 25 }],
    }, "salesforce");

    expect(result.selectedValues).toEqual(["Beacon Analytics Package"]);
    expect(result.campaignMappings).toHaveLength(1);
  });

  it("uses the source-confirmed selection boundary when aligning a connection config", () => {
    const result = clearGa4CrmPipelineProxyMapping({
      ...sourceConfig,
      campaignValueRevenueTotals: undefined,
    }, "salesforce", ["Beacon Analytics Package"]);

    expect(result.selectedValues).toEqual(["Beacon Analytics Package"]);
    expect(result.campaignMappings).toHaveLength(1);
  });

  it("fails safely for a legacy mapping without confirmed totals by removing only proven proxy values", () => {
    const result = clearGa4CrmPipelineProxyMapping({
      ...sourceConfig,
      selectedValues: ["Unclassified Saved Value", "Acme Expansion"],
      campaignValueRevenueTotals: undefined,
      pipelineValueRevenueTotals: [{ campaignValue: "Acme Expansion", revenue: 150 }],
    }, "hubspot");

    expect(result.selectedValues).toEqual(["Unclassified Saved Value"]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

const mocks = vi.hoisted(() => {
  const state = {
    selectQueue: [] as any[][],
    inserts: [] as any[],
    updates: [] as any[],
    events: new Map<string, any>(),
  };
  const selectResult = () => {
    const consume = async () => state.selectQueue.shift() || [];
    const limit = vi.fn(consume);
    return {
      limit,
      orderBy: vi.fn(consume),
      for: vi.fn(() => ({ limit })),
      then: (resolve: (value: any[]) => unknown, reject: (reason: unknown) => unknown) => consume().then(resolve, reject),
    };
  };
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(selectResult),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: any) => {
        const returning = async () => {
          state.inserts.push(values);
          if (values.eventId) {
            if (state.events.has(values.eventId)) return [];
            const created = { id: "event-row-1", receivedAt: new Date("2026-10-14T10:00:00.000Z"), ...values };
            state.events.set(values.eventId, created);
            return [created];
          }
          return [{ id: "created-row-1", ...values }];
        };
        return {
          returning,
          onConflictDoNothing: vi.fn(() => ({ returning })),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => {
          state.updates.push(values);
          return { returning: vi.fn(async () => [{ id: "updated-row-1", ...values }]) };
        }),
      })),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => callback(tx));
  return { state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";
import { createMimosaasTrackingCredentials, verifyMimosaasTrackingSecret } from "./utils/mimosaas-tracking-auth";

const website = {
  id: "website-1",
  ownerId: "owner-1",
  clientId: "client-1",
  websiteUrl: "https://example.com",
};

const event = {
  eventId: "event-1",
  eventTime: new Date("2026-10-14T09:59:00.000Z"),
  anonymousVisitorId: "visitor-1",
  sessionId: "session-1",
  eventName: "page_view",
  url: "https://example.com/?utm_campaign=autumn",
  utmCampaign: "autumn",
};

describe("Mimosaas Tracking storage safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.selectQueue = [];
    mocks.state.inserts = [];
    mocks.state.updates = [];
    mocks.state.events.clear();
  });

  it("derives raw-event client and website scope from the verified connection", async () => {
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website]];

    const result = await new DatabaseStorage().createMimosaasTrackingEvent("website-1", {
      ...event,
      id: "attacker-row-id",
      receivedAt: new Date("2000-01-01T00:00:00.000Z"),
      clientId: "attacker-client",
      websiteConnectionId: "attacker-website",
    } as any);

    expect(result.inserted).toBe(true);
    expect(result.event).toMatchObject({
      id: "event-row-1",
      receivedAt: new Date("2026-10-14T10:00:00.000Z"),
      clientId: "client-1",
      websiteConnectionId: "website-1",
    });
    expect(mocks.state.events).toHaveLength(1);
    expect(mocks.state.updates).toHaveLength(1);
  });

  it("accepts an identical event retry without inserting or touching last-event state twice", async () => {
    const storage = new DatabaseStorage();
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website]];
    const first = await storage.createMimosaasTrackingEvent("website-1", event as any);
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [first.event]];

    const retry = await storage.createMimosaasTrackingEvent("website-1", event as any);

    expect(retry).toEqual({ event: first.event, inserted: false });
    expect(mocks.state.events).toHaveLength(1);
    expect(mocks.state.updates).toHaveLength(1);
  });

  it("fails closed when an event ID is reused for different immutable data", async () => {
    const storage = new DatabaseStorage();
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website]];
    const first = await storage.createMimosaasTrackingEvent("website-1", event as any);
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [first.event]];

    await expect(storage.createMimosaasTrackingEvent("website-1", {
      ...event,
      sessionId: "different-session",
    } as any)).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_EVENT_ID_CONFLICT" });
    expect(mocks.state.events).toHaveLength(1);
    expect(mocks.state.updates).toHaveLength(1);
  });

  it("fails closed when another website reuses an existing event ID", async () => {
    const storage = new DatabaseStorage();
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website]];
    const first = await storage.createMimosaasTrackingEvent("website-1", event as any);
    const otherWebsite = { ...website, id: "website-2", ownerId: "owner-2", clientId: "client-2" };
    mocks.state.selectQueue = [[otherWebsite], [{ id: "client-2" }], [otherWebsite], [first.event]];

    await expect(storage.createMimosaasTrackingEvent("website-2", event as any))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_EVENT_ID_CONFLICT" });
    expect(mocks.state.events).toHaveLength(1);
  });

  it("fails before insertion when an attributed campaign is outside the website scope", async () => {
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], []];

    await expect(new DatabaseStorage().createMimosaasTrackingEvent("website-1", {
      ...event,
      resolvedCampaignId: "foreign-campaign",
      campaignResolutionStatus: "attributed",
    } as any)).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_CAMPAIGN_SCOPE_NOT_FOUND" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("fails before insertion when the website connection does not exist", async () => {
    mocks.state.selectQueue = [[]];

    await expect(new DatabaseStorage().createMimosaasTrackingEvent("missing-website", event as any))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_WEBSITE_NOT_FOUND" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("looks up public ingestion credentials only by the exact tracking ID", async () => {
    mocks.state.selectQueue = [[{ ...website, trackingPublicId: "mtk_exact" }]];

    const connection = await new DatabaseStorage().getMimosaasWebsiteConnectionByTrackingPublicId("mtk_exact");

    expect(connection).toMatchObject({ id: "website-1", trackingPublicId: "mtk_exact" });
  });

  it("fails closed when credentials rotate between authentication and event insertion", async () => {
    mocks.state.selectQueue = [
      [{ ...website, trackingSecretHash: "sha256:old" }],
      [{ id: "client-1" }],
      [{ ...website, trackingSecretHash: "sha256:new", installationStatus: "verified" }],
    ];

    await expect(new DatabaseStorage().createMimosaasTrackingEvent("website-1", event as any, "sha256:old"))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_AUTH_INVALID" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("fails closed when the event URL is outside the connected website", async () => {
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website]];

    await expect(new DatabaseStorage().createMimosaasTrackingEvent("website-1", {
      ...event,
      url: "https://attacker.example/landing",
    } as any)).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_EVENT_WEBSITE_SCOPE_MISMATCH" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("verifies a pending installation atomically without inserting an analytics event", async () => {
    const pendingWebsite = { ...website, installationStatus: "pending", trackingSecretHash: "sha256:current" };
    mocks.state.selectQueue = [[pendingWebsite], [{ id: "client-1" }], [pendingWebsite]];

    const verified = await new DatabaseStorage().verifyMimosaasWebsiteConnectionInstallation(
      "website-1", "sha256:current", "https://example.com/landing",
    );

    expect(verified).toMatchObject({
      newlyVerified: true,
      connection: { installationStatus: "verified", verifiedAt: expect.any(Date), lastEventAt: expect.any(Date) },
    });
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.events).toHaveLength(0);
    expect(mocks.state.updates).toHaveLength(1);
  });

  it("makes repeated installation verification idempotent", async () => {
    const verifiedWebsite = { ...website, installationStatus: "verified", trackingSecretHash: "sha256:current", verifiedAt: new Date("2026-10-15T10:00:00.000Z") };
    mocks.state.selectQueue = [[verifiedWebsite], [{ id: "client-1" }], [verifiedWebsite]];

    const verified = await new DatabaseStorage().verifyMimosaasWebsiteConnectionInstallation(
      "website-1", "sha256:current", "https://example.com/landing",
    );

    expect(verified).toEqual({ connection: verifiedWebsite, newlyVerified: false });
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("rejects installation verification after credential rotation or website change", async () => {
    const currentWebsite = { ...website, installationStatus: "pending", trackingSecretHash: "sha256:new" };
    mocks.state.selectQueue = [[currentWebsite], [{ id: "client-1" }], [currentWebsite]];
    await expect(new DatabaseStorage().verifyMimosaasWebsiteConnectionInstallation(
      "website-1", "sha256:old", "https://example.com/landing",
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_AUTH_INVALID" });

    mocks.state.selectQueue = [[currentWebsite], [{ id: "client-1" }], [currentWebsite]];
    await expect(new DatabaseStorage().verifyMimosaasWebsiteConnectionInstallation(
      "website-1", "sha256:new", "https://attacker.example/landing",
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_EVENT_WEBSITE_SCOPE_MISMATCH" });

    const disconnectedWebsite = { ...currentWebsite, installationStatus: "disconnected" };
    mocks.state.selectQueue = [[disconnectedWebsite], [{ id: "client-1" }], [disconnectedWebsite]];
    await expect(new DatabaseStorage().verifyMimosaasWebsiteConnectionInstallation(
      "website-1", "sha256:new", "https://example.com/landing",
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_CONNECTION_INACTIVE" });
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("fails before configuration creation when campaign ownership is not proven", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }], []];

    await expect(new DatabaseStorage().createMimosaasTrackingConfiguration(
      "owner-1",
      "client-1",
      "campaign-1",
      { websiteConnectionId: "website-1" } as any,
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_CAMPAIGN_SCOPE_NOT_FOUND" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("derives website ownership and strips caller-supplied row identity", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }]];

    const created = await new DatabaseStorage().createMimosaasWebsiteConnection("owner-1", "client-1", {
      id: "attacker-row-id",
      ownerId: "attacker-owner",
      clientId: "attacker-client",
      websiteUrl: "https://example.com",
      installationMethod: "universal",
    } as any);

    expect(created).toMatchObject({ id: "created-row-1", ownerId: "owner-1", clientId: "client-1" });
    expect(mocks.state.inserts[0]).not.toHaveProperty("id");
    expect(mocks.state.inserts[0]).not.toHaveProperty("trackingSecret");
    expect(verifyMimosaasTrackingSecret(created.trackingSecret, mocks.state.inserts[0].trackingSecretHash)).toBe(true);
  });

  it("rotates only an owned website secret and resets installation verification", async () => {
    const oldCredentials = createMimosaasTrackingCredentials();
    mocks.state.selectQueue = [[{ id: "client-1" }], [{ ...website, trackingPublicId: "mtk_existing", trackingSecretHash: oldCredentials.trackingSecretHash }]];

    const rotated = await new DatabaseStorage().rotateMimosaasWebsiteConnectionSecret("owner-1", "client-1", "website-1");

    expect(rotated).toMatchObject({ trackingPublicId: "mtk_existing", installationStatus: "pending" });
    expect(mocks.state.updates[0]).toMatchObject({
      trackingPublicId: "mtk_existing",
      installationStatus: "pending",
      installationMetadata: null,
      verifiedAt: null,
      lastEventAt: null,
    });
    expect(mocks.state.updates[0]).not.toHaveProperty("trackingSecret");
    expect(verifyMimosaasTrackingSecret(rotated!.trackingSecret, mocks.state.updates[0].trackingSecretHash)).toBe(true);
    expect(verifyMimosaasTrackingSecret(oldCredentials.trackingSecret, mocks.state.updates[0].trackingSecretHash)).toBe(false);
  });

  it("does not rotate a secret when the website is outside the owned client", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }], []];

    await expect(new DatabaseStorage().rotateMimosaasWebsiteConnectionSecret("owner-1", "client-1", "foreign-website"))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_WEBSITE_SCOPE_NOT_FOUND" });
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("does not allow a website update payload to change tenant scope", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }], [website]];

    await new DatabaseStorage().updateMimosaasWebsiteConnection("owner-1", "client-1", "website-1", {
      ownerId: "attacker-owner",
      clientId: "attacker-client",
      installationStatus: "verified",
    } as any);

    expect(mocks.state.updates[0]).toMatchObject({ installationStatus: "verified" });
    expect(mocks.state.updates[0]).not.toHaveProperty("ownerId");
    expect(mocks.state.updates[0]).not.toHaveProperty("clientId");
  });

  it("derives configuration campaign scope and strips caller-supplied row identity", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }], [{ id: "campaign-1" }], [website]];

    const created = await new DatabaseStorage().createMimosaasTrackingConfiguration(
      "owner-1",
      "client-1",
      "campaign-1",
      { id: "attacker-row-id", campaignId: "attacker-campaign", websiteConnectionId: "website-1" } as any,
    );

    expect(created).toMatchObject({ id: "created-row-1", campaignId: "campaign-1", websiteConnectionId: "website-1" });
    expect(mocks.state.inserts[0]).not.toHaveProperty("id");
  });

  it("does not allow configuration updates to move between campaigns or websites", async () => {
    mocks.state.selectQueue = [
      [{ id: "client-1" }],
      [{ id: "campaign-1" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1" }],
      [website],
    ];

    await new DatabaseStorage().updateMimosaasTrackingConfiguration("owner-1", "client-1", "campaign-1", {
      campaignId: "attacker-campaign",
      websiteConnectionId: "attacker-website",
      status: "active",
    } as any);

    expect(mocks.state.updates[0]).toMatchObject({ status: "active" });
    expect(mocks.state.updates[0]).not.toHaveProperty("campaignId");
    expect(mocks.state.updates[0]).not.toHaveProperty("websiteConnectionId");
  });

  it("forces the proven campaign and configuration IDs onto a new mapping", async () => {
    mocks.state.selectQueue = [
      [{ id: "client-1" }],
      [{ id: "campaign-1" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1" }],
      [website],
      [{ id: "configuration-1" }],
      [],
    ];

    const created = await new DatabaseStorage().createMimosaasTrackingCampaignMapping(
      "owner-1",
      "client-1",
      "campaign-1",
      {
        campaignId: "attacker-campaign",
        trackingConfigurationId: "attacker-configuration",
        mappingType: "utm_campaign",
        campaignValue: "autumn",
      } as any,
    );

    expect(created).toMatchObject({
      campaignId: "campaign-1",
      trackingConfigurationId: "configuration-1",
      mappingType: "utm_campaign",
      campaignValue: "autumn",
    });
    expect(mocks.state.updates).toContainEqual(expect.objectContaining({ status: "draft" }));
  });

  it("rejects an active mapping already used by the same website", async () => {
    mocks.state.selectQueue = [
      [{ id: "client-1" }],
      [{ id: "campaign-1" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1" }],
      [website],
      [{ id: "configuration-1" }, { id: "configuration-2" }],
      [{ id: "mapping-on-other-campaign" }],
    ];

    await expect(new DatabaseStorage().createMimosaasTrackingCampaignMapping(
      "owner-1",
      "client-1",
      "campaign-1",
      { mappingType: "utm_campaign", campaignValue: "autumn" } as any,
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_MAPPING_CONFLICT" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("does not allow mapping updates to move between campaigns or configurations", async () => {
    mocks.state.selectQueue = [
      [{ id: "client-1" }],
      [{ id: "campaign-1" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1" }],
      [website],
      [{ id: "mapping-1", campaignId: "campaign-1", trackingConfigurationId: "configuration-1", mappingType: "utm_campaign", campaignValue: "autumn", isActive: true }],
    ];

    await new DatabaseStorage().updateMimosaasTrackingCampaignMapping(
      "owner-1",
      "client-1",
      "campaign-1",
      "mapping-1",
      {
        campaignId: "attacker-campaign",
        trackingConfigurationId: "attacker-configuration",
        isActive: false,
      } as any,
    );

    expect(mocks.state.updates[0]).toMatchObject({ isActive: false });
    expect(mocks.state.updates[0]).not.toHaveProperty("campaignId");
    expect(mocks.state.updates[0]).not.toHaveProperty("trackingConfigurationId");
    expect(mocks.state.updates).toContainEqual(expect.objectContaining({ status: "draft" }));
  });

  it("atomically finalizes only a verified draft with an active exact campaign mapping", async () => {
    mocks.state.selectQueue = [
      [{ id: "client-1" }],
      [{ id: "campaign-1", ownerId: "owner-1", clientId: "client-1", status: "draft", platform: "manual" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "draft" }],
      [{ ...website, installationStatus: "verified" }],
      [{ id: "mapping-1" }],
    ];

    const result = await new DatabaseStorage().finalizeMimosaasTrackingCampaign("owner-1", "client-1", "campaign-1");

    expect(result.configuration).toMatchObject({ status: "active" });
    expect(result.campaign).toMatchObject({ platform: "mimosaas-tracking", status: "active" });
    expect(mocks.state.updates).toHaveLength(2);
  });

  it("keeps the campaign draft when website verification or mapping proof is missing", async () => {
    const baseRows = [
      [{ id: "client-1" }],
      [{ id: "campaign-1", ownerId: "owner-1", clientId: "client-1", status: "draft", platform: "manual" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "draft" }],
    ];
    mocks.state.selectQueue = [...baseRows, [{ ...website, installationStatus: "pending" }]];
    await expect(new DatabaseStorage().finalizeMimosaasTrackingCampaign("owner-1", "client-1", "campaign-1"))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_INSTALLATION_NOT_VERIFIED" });

    mocks.state.selectQueue = [...baseRows, [{ ...website, installationStatus: "verified" }], []];
    await expect(new DatabaseStorage().finalizeMimosaasTrackingCampaign("owner-1", "client-1", "campaign-1"))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_MAPPING_REQUIRED" });
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("keeps all persistence hidden and explicitly owner, client, and campaign scoped", () => {
    const storage = fs.readFileSync(path.join(process.cwd(), "server", "storage.ts"), "utf8");
    const start = storage.indexOf("private async requireMimosaasOwnedClient");
    const end = storage.indexOf("// Metrics methods", start);
    const implementation = storage.slice(start, end);

    expect(implementation).toContain("eq(clients.ownerId, ownerId)");
    expect(implementation).toContain("eq(campaigns.ownerId, ownerId)");
    expect(implementation).toContain("eq(campaigns.clientId, clientId)");
    expect(implementation).toContain("eq(mimosaasWebsiteConnections.ownerId, ownerId)");
    expect(implementation).toContain("eq(mimosaasWebsiteConnections.clientId, clientId)");
    expect(implementation).toContain("onConflictDoNothing");
    expect(implementation).toContain("MIMOSAAS_TRACKING_EVENT_ID_CONFLICT");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

const mocks = vi.hoisted(() => {
  const state = {
    selectQueue: [] as any[][],
    inserts: [] as any[],
    upserts: [] as any[],
    updates: [] as any[],
    executeQueue: [] as any[][],
    events: new Map<string, any>(),
  };
  const selectResult = () => {
    const consume = async () => state.selectQueue.shift() || [];
    const limit = vi.fn(consume);
    const locked = { limit, then: (resolve: (value: any[]) => unknown, reject: (reason: unknown) => unknown) => consume().then(resolve, reject) };
    const ordered = { limit, then: (resolve: (value: any[]) => unknown, reject: (reason: unknown) => unknown) => consume().then(resolve, reject) };
    return {
      limit,
      orderBy: vi.fn(() => ordered),
      for: vi.fn(() => locked),
      then: (resolve: (value: any[]) => unknown, reject: (reason: unknown) => unknown) => consume().then(resolve, reject),
    };
  };
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const joined = { where: vi.fn(selectResult) };
        return { ...joined, leftJoin: vi.fn(() => joined) };
      }),
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
          onConflictDoUpdate: vi.fn((config: any) => {
            state.upserts.push(config);
            return { returning };
          }),
        };
      }),
    })),
    execute: vi.fn(async () => ({ rows: state.executeQueue.shift() || [] })),
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
    mocks.state.upserts = [];
    mocks.state.updates = [];
    mocks.state.executeQueue = [];
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

  it("attributes a stored event to one exact active utm_campaign mapping", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null, utmCampaign: "autumn" };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [],
      [{ id: "configuration-1", campaignId: "campaign-1" }],
      [{ trackingConfigurationId: "configuration-1", campaignId: "campaign-1" }],
      [{ id: "campaign-1" }],
    ];

    const attribution = await new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1");

    expect(attribution).toMatchObject({
      eventId: "event-1",
      clientId: "client-1",
      websiteConnectionId: "website-1",
      campaignId: "campaign-1",
      status: "attributed",
      resolutionSource: "utm_campaign",
      externalCampaignId: "autumn",
      resolvedAt: expect.any(Date),
    });
  });

  it("keeps an event with gclid pending without applying its UTM mapping", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: "click-1", utmCampaign: "autumn" };
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [storedEvent], []];

    const attribution = await new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1");

    expect(attribution).toMatchObject({ eventId: "event-1", campaignId: null, status: "pending", resolutionSource: null });
    expect(mocks.tx.select).toHaveBeenCalledTimes(5);
  });

  it("returns only active same-website tracker campaigns as Google Ads lookup candidates", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: "click-1" };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent],
      [{ campaignId: "campaign-1" }, { campaignId: "campaign-2" }],
      [{ id: "campaign-2" }],
    ];

    await expect(new DatabaseStorage().getMimosaasTrackingGclidAttributionContext("website-1", "event-1"))
      .resolves.toMatchObject({ gclid: "click-1", candidateCampaignIds: ["campaign-2"] });
  });

  it("timestamps an unresolved Google Ads lookup so retries are database paced", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: "click-1" };
    const pendingAttribution = { id: "attribution-1", eventId: "event-1", clientId: "client-1", websiteConnectionId: "website-1", campaignId: null, status: "pending" };
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [storedEvent], [pendingAttribution]];

    await expect(new DatabaseStorage().deferMimosaasTrackingGclidAttribution("website-1", "event-1", "click-1"))
      .resolves.toMatchObject({ id: "updated-row-1", updatedAt: expect.any(Date) });
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.updates).toHaveLength(1);
  });

  it("persists a proven Google Ads match only when its campaign selection is still active", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: "click-1", utmCampaign: "autumn" };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [],
      [{ id: "configuration-1", campaignId: "campaign-1" }],
      [{ id: "campaign-1" }],
      [{ campaignId: "campaign-1", method: "oauth", spendOnly: false, selectedCampaignIds: '["101"]' }],
      [{ trackingConfigurationId: "configuration-1", campaignId: "campaign-1" }],
      [{ id: "campaign-1" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingGclidAttribution(
      "website-1", "event-1", "click-1", [{ campaignId: "campaign-1", externalCampaignId: "101" }],
    )).resolves.toMatchObject({
      campaignId: "campaign-1", status: "attributed", resolutionSource: "gclid", externalCampaignId: "101",
    });
  });

  it("records a conflict when gclid and utm_campaign prove different Mimosaas campaigns", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: "click-1", utmCampaign: "autumn" };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [],
      [{ id: "configuration-1", campaignId: "campaign-1" }, { id: "configuration-2", campaignId: "campaign-2" }],
      [{ id: "campaign-1" }],
      [{ campaignId: "campaign-1", method: "oauth", spendOnly: false, selectedCampaignIds: '["101"]' }],
      [{ trackingConfigurationId: "configuration-2", campaignId: "campaign-2" }],
      [{ id: "campaign-2" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingGclidAttribution(
      "website-1", "event-1", "click-1", [{ campaignId: "campaign-1", externalCampaignId: "101" }],
    )).resolves.toMatchObject({
      campaignId: null,
      status: "conflict",
      resolutionSource: "gclid",
      conflictDetails: { reason: "gclid_utm_campaign_mismatch", gclidCampaignId: "campaign-1", utmCampaignIds: ["campaign-2"] },
    });
  });

  it("records a conflict when one Google Ads click matches multiple scoped Mimosaas campaigns", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: "click-1", utmCampaign: null };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [],
      [{ id: "configuration-1", campaignId: "campaign-1" }, { id: "configuration-2", campaignId: "campaign-2" }],
      [{ id: "campaign-1" }, { id: "campaign-2" }],
      [
        { campaignId: "campaign-1", method: "oauth", spendOnly: false, selectedCampaignIds: '["101"]' },
        { campaignId: "campaign-2", method: "oauth", spendOnly: false, selectedCampaignIds: '["202"]' },
      ],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingGclidAttribution(
      "website-1", "event-1", "click-1", [
        { campaignId: "campaign-1", externalCampaignId: "101" },
        { campaignId: "campaign-2", externalCampaignId: "202" },
      ],
    )).resolves.toMatchObject({
      campaignId: null,
      status: "conflict",
      resolutionSource: "gclid",
      conflictDetails: { reason: "multiple_google_ads_click_matches" },
    });
  });

  it("rejects stale Google Ads evidence after the selected campaign scope changes", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: "click-1", utmCampaign: null };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [],
      [{ id: "configuration-1", campaignId: "campaign-1" }],
      [{ id: "campaign-1" }],
      [{ campaignId: "campaign-1", method: "oauth", spendOnly: false, selectedCampaignIds: '["202"]' }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingGclidAttribution(
      "website-1", "event-1", "click-1", [{ campaignId: "campaign-1", externalCampaignId: "101" }],
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_GCLID_SCOPE_CHANGED" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("stores an unmatched explicit utm_campaign as unattributed", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null, utmCampaign: "unknown" };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [],
      [{ id: "configuration-1", campaignId: "campaign-1" }], [],
    ];

    const attribution = await new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1");

    expect(attribution).toMatchObject({
      campaignId: null,
      status: "unattributed",
      resolutionSource: "utm_campaign",
      externalCampaignId: "unknown",
      resolvedAt: expect.any(Date),
    });
  });

  it("records a conflict instead of guessing when damaged mappings resolve to multiple campaigns", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null, utmCampaign: "autumn" };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [],
      [{ id: "configuration-1", campaignId: "campaign-1" }, { id: "configuration-2", campaignId: "campaign-2" }],
      [
        { trackingConfigurationId: "configuration-1", campaignId: "campaign-1" },
        { trackingConfigurationId: "configuration-2", campaignId: "campaign-2" },
      ],
      [{ id: "campaign-1" }, { id: "campaign-2" }],
    ];

    const attribution = await new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1");

    expect(attribution).toMatchObject({
      campaignId: null,
      status: "conflict",
      resolutionSource: "utm_campaign",
      conflictDetails: { reason: "duplicate_active_utm_campaign_mapping", campaignIds: ["campaign-1", "campaign-2"] },
      resolvedAt: null,
    });
  });

  it("does not rewrite an attribution that has already been resolved", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null, utmCampaign: "autumn" };
    const existingAttribution = { id: "attribution-1", eventId: "event-1", clientId: "client-1", websiteConnectionId: "website-1", campaignId: "campaign-1", status: "attributed" };
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [storedEvent], [existingAttribution]];

    await expect(new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1"))
      .resolves.toBe(existingAttribution);
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("resolves an existing pending attribution without creating a duplicate row", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null, utmCampaign: "autumn" };
    const pendingAttribution = { id: "attribution-1", eventId: "event-1", clientId: "client-1", websiteConnectionId: "website-1", campaignId: null, status: "pending" };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [storedEvent], [pendingAttribution],
      [{ id: "configuration-1", campaignId: "campaign-1" }],
      [{ trackingConfigurationId: "configuration-1", campaignId: "campaign-1" }],
      [{ id: "campaign-1" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ id: "updated-row-1", campaignId: "campaign-1", status: "attributed" });
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.updates).toHaveLength(1);
  });

  it("fails closed when an existing attribution belongs to another website", async () => {
    const storedEvent = { ...event, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null, utmCampaign: "autumn" };
    const foreignAttribution = { id: "attribution-1", eventId: "event-1", clientId: "client-2", websiteConnectionId: "website-2", status: "pending" };
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [storedEvent], [foreignAttribution]];

    await expect(new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1"))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_ATTRIBUTION_SCOPE_CONFLICT" });
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("does not reinterpret a raw event that was already assigned before attribution processing", async () => {
    const storedEvent = {
      ...event,
      clientId: "client-1",
      websiteConnectionId: "website-1",
      resolvedCampaignId: "campaign-1",
      campaignResolutionStatus: "attributed",
    };
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [storedEvent]];

    await expect(new DatabaseStorage().resolveMimosaasTrackingUtmAttribution("website-1", "event-1"))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_EVENT_NOT_PENDING" });
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("attributes a returning direct event to the latest proven active campaign within its window", async () => {
    const directEvent = { ...event, url: "https://example.com/pricing", referrer: "https://example.com/", utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [directEvent], [],
      [{ eventId: "prior-1", eventTime: new Date("2026-10-10T09:59:00.000Z"), attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: "campaign-1", status: "attributed", resolutionSource: "utm_campaign" }],
      [{ campaignId: "campaign-1", attributionWindowDays: 30 }], [{ id: "campaign-1" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ campaignId: "campaign-1", status: "attributed", resolutionSource: "returning_direct", resolvedAt: expect.any(Date) });
  });

  it("uses the most recent eligible proof without combining campaign histories", async () => {
    const directEvent = { ...event, url: "https://example.com/pricing", referrer: null, utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [directEvent], [],
      [
        { eventId: "newer", eventTime: new Date("2026-10-13T09:59:00.000Z"), attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: "campaign-2", status: "attributed", resolutionSource: "gclid" },
        { eventId: "older", eventTime: new Date("2026-10-10T09:59:00.000Z"), attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: "campaign-1", status: "attributed", resolutionSource: "utm_campaign" },
      ],
      [{ campaignId: "campaign-1", attributionWindowDays: 30 }, { campaignId: "campaign-2", attributionWindowDays: 30 }],
      [{ id: "campaign-1" }, { id: "campaign-2" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ campaignId: "campaign-2", status: "attributed", resolutionSource: "returning_direct" });
  });

  it("stores an untagged external-referrer event as unattributed instead of borrowing history", async () => {
    const referredEvent = { ...event, url: "https://example.com/pricing", referrer: "https://search.example/results", utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [referredEvent], []];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ campaignId: null, status: "unattributed", resolutionSource: null, resolvedAt: expect.any(Date) });
    expect(mocks.tx.select).toHaveBeenCalledTimes(5);
  });

  it("stores a partially tagged event as unattributed instead of treating it as direct", async () => {
    const partialUtmEvent = { ...event, url: "https://example.com/pricing?utm_source=google", referrer: null, utmSource: "google", utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    mocks.state.selectQueue = [[website], [{ id: "client-1" }], [website], [partialUtmEvent], []];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ campaignId: null, status: "unattributed", resolutionSource: null });
    expect(mocks.tx.select).toHaveBeenCalledTimes(5);
  });

  it("does not carry a proven campaign beyond that campaign's attribution window", async () => {
    const directEvent = { ...event, url: "https://example.com/pricing", referrer: null, utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [directEvent], [],
      [{ eventId: "prior-1", eventTime: new Date("2026-09-13T09:59:00.000Z"), attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: "campaign-1", status: "attributed", resolutionSource: "gclid" }],
      [{ campaignId: "campaign-1", attributionWindowDays: 30 }], [{ id: "campaign-1" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ campaignId: null, status: "unattributed", resolutionSource: "returning_direct" });
  });

  it("keeps returning-direct attribution pending while newer source evidence is unresolved", async () => {
    const directEvent = { ...event, url: "https://example.com/pricing", referrer: null, utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [directEvent], [],
      [
        { eventId: "prior-pending", eventTime: new Date("2026-10-13T09:59:00.000Z"), attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: null, status: "pending", resolutionSource: null },
        { eventId: "prior-proven", eventTime: new Date("2026-10-10T09:59:00.000Z"), attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: "campaign-1", status: "attributed", resolutionSource: "utm_campaign" },
      ],
      [{ campaignId: "campaign-1", attributionWindowDays: 30 }], [{ id: "campaign-1" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ campaignId: null, status: "pending", resolutionSource: null, resolvedAt: null });
  });

  it("records a conflict when equally recent proven history points to different campaigns", async () => {
    const directEvent = { ...event, url: "https://example.com/pricing", referrer: null, utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    const proofTime = new Date("2026-10-13T09:59:00.000Z");
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [directEvent], [],
      [
        { eventId: "prior-1", eventTime: proofTime, attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: "campaign-1", status: "attributed", resolutionSource: "utm_campaign" },
        { eventId: "prior-2", eventTime: proofTime, attributionClientId: "client-1", attributionWebsiteConnectionId: "website-1", campaignId: "campaign-2", status: "attributed", resolutionSource: "gclid" },
      ],
      [{ campaignId: "campaign-1", attributionWindowDays: 30 }, { campaignId: "campaign-2", attributionWindowDays: 30 }],
      [{ id: "campaign-1" }, { id: "campaign-2" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .resolves.toMatchObject({ campaignId: null, status: "conflict", resolutionSource: "returning_direct", conflictDetails: { reason: "ambiguous_returning_direct_history", campaignIds: ["campaign-1", "campaign-2"] } });
  });

  it("fails closed when prior attribution evidence has a different tenant scope", async () => {
    const directEvent = { ...event, url: "https://example.com/pricing", referrer: null, utmCampaign: null, clientId: "client-1", websiteConnectionId: "website-1", resolvedCampaignId: null, campaignResolutionStatus: "pending", gclid: null };
    mocks.state.selectQueue = [
      [website], [{ id: "client-1" }], [website], [directEvent], [],
      [{ eventId: "prior-1", eventTime: new Date("2026-10-13T09:59:00.000Z"), attributionClientId: "client-2", attributionWebsiteConnectionId: "website-2", campaignId: "campaign-1", status: "attributed", resolutionSource: "utm_campaign" }],
    ];

    await expect(new DatabaseStorage().resolveMimosaasTrackingReturningDirectAttribution("website-1", "event-1"))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_ATTRIBUTION_SCOPE_CONFLICT" });
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("stores exact completed-day tracker metrics with an idempotent campaign-day upsert", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam" };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active", conversionEventNames: ["purchase", "lead", "purchase"] };
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [], [activeConfiguration], [website],
      [{ pendingCount: 0, scopeConflictCount: 0, invalidAttributionCount: 0 }],
    ];
    mocks.state.executeQueue = [[{ users: 7, sessions: 8, engagedSessions: 6, pageviews: 12, conversions: 3 }]];

    await expect(new DatabaseStorage().aggregateMimosaasTrackingDailyMetrics(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).resolves.toMatchObject({
      campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam",
      users: 7, sessions: 8, engagedSessions: 6, pageviews: 12, conversions: 3,
    });
    expect(mocks.state.upserts).toHaveLength(1);
    expect(mocks.state.inserts[0]).toMatchObject({ campaignId: "campaign-1", reportingDate: "2026-10-14" });
  });

  it("writes no daily metrics while any event attribution for the website-day is pending", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam" };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active", conversionEventNames: ["purchase"] };
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [], [activeConfiguration], [website],
      [{ pendingCount: 1, scopeConflictCount: 0, invalidAttributionCount: 0 }],
    ];

    await expect(new DatabaseStorage().aggregateMimosaasTrackingDailyMetrics(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_ATTRIBUTION_PENDING" });
    expect(mocks.tx.execute).not.toHaveBeenCalled();
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("writes no daily metrics when stored attribution scope is damaged", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam" };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active", conversionEventNames: [] };
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [], [activeConfiguration], [website],
      [{ pendingCount: 0, scopeConflictCount: 1, invalidAttributionCount: 0 }],
    ];

    await expect(new DatabaseStorage().aggregateMimosaasTrackingDailyMetrics(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_ATTRIBUTION_SCOPE_CONFLICT" });
    expect(mocks.tx.execute).not.toHaveBeenCalled();
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("rejects aggregation for the current local reporting day", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam" };
    mocks.state.selectQueue = [[{ id: "client-1" }], [activeCampaign]];

    await expect(new DatabaseStorage().aggregateMimosaasTrackingDailyMetrics(
      "owner-1", "client-1", "campaign-1", "2026-10-15", new Date("2026-10-15T08:00:00.000Z"),
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_REPORTING_DATE_INCOMPLETE" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("fails closed when the campaign is not an active Mimosaas Tracking campaign", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }], []];

    await expect(new DatabaseStorage().aggregateMimosaasTrackingDailyMetrics(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_CAMPAIGN_SCOPE_NOT_FOUND" });
    expect(mocks.tx.execute).not.toHaveBeenCalled();
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("rejects impossible aggregate values before writing the daily row", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam" };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active", conversionEventNames: ["purchase"] };
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [], [activeConfiguration], [website],
      [{ pendingCount: 0, scopeConflictCount: 0, invalidAttributionCount: 0 }],
    ];
    mocks.state.executeQueue = [[{ users: 1, sessions: 1, engagedSessions: 2, pageviews: 1, conversions: 0 }]];

    await expect(new DatabaseStorage().aggregateMimosaasTrackingDailyMetrics(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_AGGREGATION_INVALID" });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("does not rewrite mutable daily metrics after an immutable day is finalized", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam" };
    mocks.state.selectQueue = [[{ id: "client-1" }], [activeCampaign], [{ id: "snapshot-1" }]];

    await expect(new DatabaseStorage().aggregateMimosaasTrackingDailyMetrics(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_REPORTING_DATE_FINALIZED" });
    expect(mocks.tx.execute).not.toHaveBeenCalled();
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("reads durable pending and latest-finalized scheduler state only inside the owned active campaign", async () => {
    mocks.state.selectQueue = [
      [{ id: "client-1" }],
      [{ id: "campaign-1" }],
      [{ reportingDate: "2026-10-13" }],
      [{ reportingDate: "2026-10-12" }],
    ];

    await expect(new DatabaseStorage().getMimosaasTrackingDailyPublicationState(
      "owner-1", "client-1", "campaign-1", "2026-10-14",
    )).resolves.toEqual({ latestFinalizedDate: "2026-10-12", pendingDates: ["2026-10-13"] });
  });

  it("reads only the latest immutable snapshot inside the owned active campaign", async () => {
    const latest = { id: "snapshot-2", campaignId: "campaign-1", reportingDate: "2026-10-14" };
    mocks.state.selectQueue = [[{ id: "client-1" }], [{ id: "campaign-1" }], [latest]];

    await expect(new DatabaseStorage().getLatestMimosaasTrackingDailySnapshot(
      "owner-1", "client-1", "campaign-1",
    )).resolves.toEqual(latest);
  });

  it("does not read snapshots when the active Mimosaas Tracking campaign scope is absent", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }], [], [{ id: "foreign-snapshot" }]];

    await expect(new DatabaseStorage().getLatestMimosaasTrackingDailySnapshot(
      "owner-1", "client-1", "campaign-1",
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_CAMPAIGN_SCOPE_NOT_FOUND" });
    expect(mocks.state.selectQueue).toHaveLength(1);
  });

  it("atomically claims one scheduler attempt and rejects a concurrent instance", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam" };
    const now = new Date("2026-10-15T08:00:00.000Z");
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign],
      [{ id: "run-1", reportingTimeZone: "Europe/Amsterdam", status: "pending", lastAttemptAt: null }], [],
    ];
    await expect(new DatabaseStorage().claimMimosaasTrackingDailyPublicationRun(
      "owner-1", "client-1", "campaign-1", "2026-10-14", now,
    )).resolves.toBe("claimed");
    expect(mocks.state.updates.at(-1)).toMatchObject({ status: "running", lastAttemptAt: now });

    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign],
      [{ id: "run-1", reportingTimeZone: "Europe/Amsterdam", status: "running", lastAttemptAt: now }], [],
    ];
    const updateCount = mocks.state.updates.length;
    await expect(new DatabaseStorage().claimMimosaasTrackingDailyPublicationRun(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:01:00.000Z"),
    )).resolves.toBe("busy");
    expect(mocks.state.updates).toHaveLength(updateCount);
  });

  it("releases only a running attempt inside the owned active campaign", async () => {
    mocks.state.selectQueue = [[{ id: "client-1" }], [{ id: "campaign-1" }]];

    await expect(new DatabaseStorage().releaseMimosaasTrackingDailyPublicationRun(
      "owner-1", "client-1", "campaign-1", "2026-10-14", "MIMOSAAS_TRACKING_ATTRIBUTION_PENDING",
    )).resolves.toBe(true);
    expect(mocks.state.updates.at(-1)).toMatchObject({
      status: "pending",
      lastError: "MIMOSAAS_TRACKING_ATTRIBUTION_PENDING",
    });
  });

  it("atomically publishes an exact completed day when financial sources are absent", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam", currency: "EUR" };
    const run = { id: "run-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", status: "pending", finalizedAt: null };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active" };
    const dailyMetrics = { id: "metric-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", users: 7, sessions: 8, engagedSessions: 6, pageviews: 12, conversions: 3 };
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [run], [], [activeConfiguration],
      [{ ...website, installationStatus: "verified" }], [dailyMetrics], [], [], [],
    ];

    await expect(new DatabaseStorage().publishMimosaasTrackingDailySnapshot(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).resolves.toMatchObject({
      status: "published",
      reasons: [],
      snapshot: {
        campaignId: "campaign-1",
        reportingDate: "2026-10-14",
        engagementRate: "75.0000",
        conversionRate: "37.5000",
        revenue: null,
        spend: null,
        revenueStatus: "unavailable",
        spendStatus: "unavailable",
      },
    });
    expect(mocks.state.inserts).toHaveLength(1);
    expect(mocks.state.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "running" }),
      expect.objectContaining({ status: "finalized", finalizedAt: new Date("2026-10-15T08:00:00.000Z") }),
    ]));
  });

  it("materializes and publishes exact-date tracker CSV financial records in the same transaction", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam", currency: "EUR" };
    const run = { id: "run-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", status: "running", finalizedAt: null };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active" };
    const dailyMetrics = { id: "metric-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", users: 7, sessions: 8, engagedSessions: 6, pageviews: 12, conversions: 3 };
    const datedCsv = JSON.stringify({ storedDateColumn: "Date" });
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [run], [], [activeConfiguration],
      [{ ...website, installationStatus: "verified" }], [dailyMetrics],
      [{ id: "revenue-1", sourceType: "csv", currency: "EUR", mappingConfig: datedCsv }],
      [{ id: "spend-1", sourceType: "csv", currency: "EUR", mappingConfig: datedCsv }],
      [{ revenueSourceId: "revenue-1", revenue: "125.50", currency: "EUR", subCampaignUrn: null }],
      [{ spendSourceId: "spend-1", spend: "25.00", currency: "EUR" }],
    ];

    await expect(new DatabaseStorage().publishMimosaasTrackingDailySnapshot(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).resolves.toMatchObject({
      status: "published",
      snapshot: {
        revenue: "125.50",
        spend: "25.00",
        revenueStatus: "available",
        spendStatus: "available",
      },
    });
    expect(mocks.state.inserts).toHaveLength(2);
    expect(mocks.state.inserts[0]).toMatchObject({
      campaignId: "campaign-1",
      snapshotType: "financial_daily",
      reportingDate: "2026-10-14",
      metrics: {
        financialDaily: {
          currentValueWindow: { startDate: "2026-10-14", endDate: "2026-10-14" },
          inputs: {
            revenue: { value: "125.50", sources: ["revenue-source:revenue-1"] },
            spend: { value: "25.00", sources: ["spend-source:spend-1"] },
            conversions: { value: 3, sources: ["mimosaas_tracking"] },
          },
        },
      },
    });
  });

  it("keeps provider-backed tracker financial sources pending without writing a snapshot", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam", currency: "EUR" };
    const run = { id: "run-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", status: "running", finalizedAt: null };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active" };
    const dailyMetrics = { id: "metric-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", users: 7, sessions: 8, engagedSessions: 6, pageviews: 12, conversions: 3 };
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [run], [], [activeConfiguration],
      [{ ...website, installationStatus: "verified" }], [dailyMetrics],
      [{ id: "shopify-1", sourceType: "shopify", currency: "EUR", mappingConfig: "{}" }],
      [], [],
    ];

    await expect(new DatabaseStorage().publishMimosaasTrackingDailySnapshot(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).resolves.toMatchObject({
      status: "pending",
      reasons: expect.arrayContaining([
        "revenue_source_refresh_unsupported:shopify",
        "financial_snapshot_pending",
      ]),
    });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("keeps publication pending without writing an immutable snapshot when the aggregate is absent", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam", currency: "EUR" };
    const run = { id: "run-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", status: "pending", finalizedAt: null };
    const activeConfiguration = { id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "active" };
    mocks.state.selectQueue = [
      [{ id: "client-1" }], [activeCampaign], [run], [], [activeConfiguration],
      [{ ...website, installationStatus: "verified" }], [], [], [], [],
    ];

    await expect(new DatabaseStorage().publishMimosaasTrackingDailySnapshot(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T08:00:00.000Z"),
    )).resolves.toEqual({ status: "pending", reasons: ["website_metrics_pending"] });
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "pending", lastError: "website_metrics_pending" }),
    ]));
  });

  it("returns an already finalized immutable day without reading mutable inputs again", async () => {
    const activeCampaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", platform: "mimosaas-tracking", status: "active", reportingTimeZone: "Europe/Amsterdam", currency: "EUR" };
    const run = { id: "run-1", campaignId: "campaign-1", reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam", status: "finalized", finalizedAt: new Date("2026-10-15T08:00:00.000Z") };
    const snapshot = { id: "snapshot-1", campaignId: "campaign-1", reportingDate: "2026-10-14", sourceStates: {}, publishedAt: new Date("2026-10-15T08:00:00.000Z") };
    mocks.state.selectQueue = [[{ id: "client-1" }], [activeCampaign], [run], [snapshot]];

    await expect(new DatabaseStorage().publishMimosaasTrackingDailySnapshot(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T14:00:00.000Z"),
    )).resolves.toEqual({ status: "finalized", reasons: [], snapshot });
    expect(mocks.tx.select).toHaveBeenCalledTimes(4);
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("keeps the daily metric SQL scoped to final attribution and the locked metric definitions", () => {
    const storageSource = fs.readFileSync(path.join(process.cwd(), "server", "storage.ts"), "utf8");
    const aggregation = storageSource.slice(
      storageSource.indexOf("async aggregateMimosaasTrackingDailyMetrics"),
      storageSource.indexOf("// Metrics methods"),
    );

    expect(aggregation).toContain("COUNT(DISTINCT anonymous_visitor_id)");
    expect(aggregation).toContain("COUNT(DISTINCT session_id)");
    expect(aggregation).toContain("event_name = 'page_view'");
    expect(aggregation).toContain("event_name = 'user_engagement'");
    expect(aggregation).toContain("pageviews >= 2 OR has_engagement OR has_conversion");
    expect(aggregation).toContain("mimosaasTrackingAttributions.status} = 'attributed'");
    expect(aggregation).toContain("mimosaasTrackingAttributions.campaignId} = ${campaignId}");
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

  it("claims one GTM installation attempt atomically", async () => {
    const connection = { ...website, trackingSecretHash: "sha256:current", installationStatus: "pending", installationMetadata: null };
    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];

    const result = await new DatabaseStorage().claimMimosaasGtmInstallation(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-1", "accounts/1/containers/10", "2026-10-15T10:00:00.000Z",
    );

    expect(result).toMatchObject({ alreadyInstalled: false, connection: { installationMetadata: { status: "installing", attemptId: "attempt-1" } } });
    expect(mocks.state.updates[0]).not.toHaveProperty("trackingSecret");
    expect(mocks.state.updates[0]).not.toHaveProperty("trackingSecretHash");
  });

  it("rejects a concurrent GTM installation while the first claim is current", async () => {
    const connection = {
      ...website,
      trackingSecretHash: "sha256:current",
      installationStatus: "pending",
      installationMetadata: { status: "installing", attemptId: "attempt-1", claimedAt: new Date().toISOString() },
    };
    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];

    await expect(new DatabaseStorage().claimMimosaasGtmInstallation(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-2", "accounts/1/containers/10", "2026-10-15T10:00:00.000Z",
    )).rejects.toMatchObject({ code: "MIMOSAAS_GTM_INSTALLATION_IN_PROGRESS" });
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("recovers a stale GTM installation claim", async () => {
    const connection = {
      ...website,
      trackingSecretHash: "sha256:current",
      installationStatus: "pending",
      installationMetadata: { status: "installing", attemptId: "abandoned", claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString() },
    };
    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];

    await expect(new DatabaseStorage().claimMimosaasGtmInstallation(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-2", "accounts/1/containers/10", "2026-10-15T10:00:00.000Z",
    )).resolves.toMatchObject({ alreadyInstalled: false, connection: { installationMetadata: { attemptId: "attempt-2" } } });
  });

  it("does not republish a completed GTM installation for the same credentials and container", async () => {
    const connection = {
      ...website,
      trackingSecretHash: "sha256:current",
      installationStatus: "verified",
      installationMetadata: {
        status: "published",
        containerPath: "accounts/1/containers/10",
        credentialCreatedAt: "2026-10-15T10:00:00.000Z",
        publishedAt: "2026-10-15T10:05:00.000Z",
      },
    };
    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];

    await expect(new DatabaseStorage().claimMimosaasGtmInstallation(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-2", "accounts/1/containers/10", "2026-10-15T10:00:00.000Z",
    )).resolves.toEqual({ connection, alreadyInstalled: true });
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("records GTM metadata only for the matching installation claim", async () => {
    const connection = {
      ...website,
      trackingSecretHash: "sha256:current",
      installationStatus: "pending",
      installationMetadata: { status: "installing", attemptId: "attempt-1" },
    };
    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];

    await expect(new DatabaseStorage().recordMimosaasGtmInstallation(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-1", { containerPublicId: "GTM-WEB" },
    )).resolves.toMatchObject({ installationMethod: "google_tag_manager", installationMetadata: { status: "published", containerPublicId: "GTM-WEB" } });

    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];
    await expect(new DatabaseStorage().recordMimosaasGtmInstallation(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-2", { containerPublicId: "GTM-WEB" },
    )).rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_AUTH_INVALID" });
  });

  it("preserves a same-secret verification that races with GTM metadata persistence", async () => {
    const connection = {
      ...website,
      trackingSecretHash: "sha256:current",
      installationStatus: "verified",
      installationMetadata: { status: "installing", attemptId: "attempt-1" },
    };
    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];

    await expect(new DatabaseStorage().recordMimosaasGtmInstallation(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-1", { containerPublicId: "GTM-WEB" },
    )).resolves.toMatchObject({ installationMethod: "google_tag_manager" });
    expect(mocks.state.updates[0]).not.toHaveProperty("installationStatus");
  });

  it("releases only the matching failed GTM installation claim", async () => {
    const connection = {
      ...website,
      trackingSecretHash: "sha256:current",
      installationStatus: "pending",
      installationMetadata: { status: "installing", attemptId: "attempt-1" },
    };
    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];
    await expect(new DatabaseStorage().releaseMimosaasGtmInstallationClaim(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-2",
    )).resolves.toBe(false);
    expect(mocks.state.updates).toHaveLength(0);

    mocks.state.selectQueue = [[{ id: "client-1" }], [connection]];
    await expect(new DatabaseStorage().releaseMimosaasGtmInstallationClaim(
      "owner-1", "client-1", "website-1", "sha256:current", "attempt-1",
    )).resolves.toBe(true);
    expect(mocks.state.updates[0]).toMatchObject({ installationMetadata: null });
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

  it("accepts a scoped OAuth Google Ads campaign selection only when explicitly enabled", async () => {
    mocks.state.selectQueue = [
      [{ id: "client-1" }],
      [{ id: "campaign-1", ownerId: "owner-1", clientId: "client-1", status: "draft", platform: "manual" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "draft" }],
      [{ ...website, installationStatus: "verified" }],
      [],
      [{ selectedCampaignIds: JSON.stringify(["123456789"]) }],
    ];

    const result = await new DatabaseStorage().finalizeMimosaasTrackingCampaign("owner-1", "client-1", "campaign-1", true);

    expect(result.configuration).toMatchObject({ status: "active" });
    expect(result.campaign).toMatchObject({ platform: "mimosaas-tracking", status: "active" });
    expect(mocks.state.updates).toHaveLength(2);
  });

  it("keeps the campaign draft when the Google Ads selection is empty or malformed", async () => {
    const baseRows = [
      [{ id: "client-1" }],
      [{ id: "campaign-1", ownerId: "owner-1", clientId: "client-1", status: "draft", platform: "manual" }],
      [{ id: "configuration-1", campaignId: "campaign-1", websiteConnectionId: "website-1", status: "draft" }],
      [{ ...website, installationStatus: "verified" }],
      [],
    ];
    mocks.state.selectQueue = [...baseRows, [{ selectedCampaignIds: JSON.stringify(["not-a-google-campaign-id"]) }]];

    await expect(new DatabaseStorage().finalizeMimosaasTrackingCampaign("owner-1", "client-1", "campaign-1", true))
      .rejects.toMatchObject({ code: "MIMOSAAS_TRACKING_MAPPING_REQUIRED" });
    expect(mocks.state.updates).toHaveLength(0);
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

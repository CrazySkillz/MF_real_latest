import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import {
  buildMimosaasGtmAuthorization,
  installMimosaasGtmTag,
  listMimosaasGtmContainers,
  resolveMimosaasGtmAuthorization,
} from "./mimosaas-gtm-installer";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

describe("Mimosaas Google Tag Manager installer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists only web containers and recommends an exact website-domain match", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ account: [{ path: "accounts/1" }] }))
      .mockResolvedValueOnce(jsonResponse({ container: [
        { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainName: ["example.com"], usageContext: ["web"] },
        { path: "accounts/1/containers/11", publicId: "GTM-APP", name: "App", domainName: ["example.com"], usageContext: ["android"] },
      ] }));

    await expect(listMimosaasGtmContainers("access-token", "https://www.example.com/path")).resolves.toEqual([{
      path: "accounts/1/containers/10",
      publicId: "GTM-WEB",
      name: "Website",
      domainNames: ["example.com"],
      recommended: true,
    }]);
  });

  it("binds the short-lived authorization to actor, campaign, connection, and listed container", () => {
    const container = { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainNames: ["example.com"], recommended: true };
    const authorization = buildMimosaasGtmAuthorization({
      actorId: "owner-1", campaignId: "campaign-1", connectionId: "website-1",
      accessToken: "access-token", containers: [container], now: 1_000,
    });

    expect(resolveMimosaasGtmAuthorization({
      authorization, actorId: "owner-1", campaignId: "campaign-1", connectionId: "website-1",
      containerPath: container.path, now: 2_000,
    })).toEqual({ accessToken: "access-token", container });
    expect(resolveMimosaasGtmAuthorization({
      authorization, actorId: "other-owner", campaignId: "campaign-1", connectionId: "website-1",
      containerPath: container.path, now: 2_000,
    })).toBeNull();
    expect(resolveMimosaasGtmAuthorization({
      authorization, actorId: "owner-1", campaignId: "campaign-1", connectionId: "website-1",
      containerPath: container.path, now: 1_000 + 10 * 60 * 1_000 + 1,
    })).toBeNull();
  });

  it("publishes one deterministic page-view trigger and custom HTML tracker tag from an isolated workspace", async () => {
    const requests: Array<{ url: string; method: string; body: any }> = [];
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const request = { url: String(url), method: String(init?.method || "GET"), body: init?.body ? JSON.parse(String(init.body)) : null };
      requests.push(request);
      if (request.url.endsWith("/workspaces") && request.method === "POST") return jsonResponse({ path: "accounts/1/containers/10/workspaces/20" });
      if (request.url.endsWith("/triggers") && request.method === "GET") return jsonResponse({ trigger: [] });
      if (request.url.endsWith("/triggers") && request.method === "POST") return jsonResponse({ path: "accounts/1/containers/10/workspaces/20/triggers/30", triggerId: "30" });
      if (request.url.endsWith("/tags") && request.method === "GET") return jsonResponse({ tag: [] });
      if (request.url.endsWith("/tags") && request.method === "POST") return jsonResponse({ path: "accounts/1/containers/10/workspaces/20/tags/40", tagId: "40" });
      if (request.url.endsWith("/workspaces/20:create_version")) return jsonResponse({ containerVersion: { path: "accounts/1/containers/10/versions/50" }, compilerError: false });
      if (request.url.endsWith("/versions/50:publish")) return jsonResponse({ containerVersion: { path: "accounts/1/containers/10/versions/50" }, compilerError: false });
      return jsonResponse({}, 404);
    });

    const metadata = await installMimosaasGtmTag({
      accessToken: "access-token",
      container: { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainNames: ["example.com"], recommended: true },
      trackingId: `mtk_${"a".repeat(32)}`,
      trackingSecret: `mts_${"b".repeat(43)}`,
      trackerOrigin: "https://app.example/path",
    });

    expect(metadata).toMatchObject({ containerPath: "accounts/1/containers/10", containerPublicId: "GTM-WEB", versionPath: "accounts/1/containers/10/versions/50" });
    expect(metadata).not.toHaveProperty("trackingSecret");
    const tagRequest = requests.find((request) => request.url.endsWith("/tags") && request.method === "POST");
    expect(tagRequest?.body).toMatchObject({ type: "html", firingTriggerId: ["30"] });
    const installationCode = String(tagRequest?.body.parameter[0].value || "");
    const inlineScript = installationCode.match(/^<script>([\s\S]+)<\/script>$/)?.[1];
    const appendedScripts: any[] = [];
    const documentMock = {
      createElement: () => ({
        attributes: {} as Record<string, string>,
        setAttribute(name: string, value: string) { this.attributes[name] = value; },
      }),
      head: { appendChild: (script: any) => appendedScripts.push(script) },
      documentElement: { appendChild: (script: any) => appendedScripts.push(script) },
    };
    expect(inlineScript).toBeTruthy();
    runInNewContext(String(inlineScript), { document: documentMock });
    expect(appendedScripts).toEqual([expect.objectContaining({
      async: true,
      src: "https://app.example/api/mimosaas-tracking/tracker.js",
      attributes: {
        "data-tracking-id": `mtk_${"a".repeat(32)}`,
        "data-tracking-secret": `mts_${"b".repeat(43)}`,
      },
    })]);
    expect(requests.map((request) => request.url)).toEqual(expect.arrayContaining([
      expect.stringContaining("/workspaces/20:create_version"),
      expect.stringContaining("/versions/50:publish"),
    ]));
  });

  it("deletes only its newly created workspace when tag creation fails", async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const target = String(url);
      const method = String(init?.method || "GET");
      if (target.endsWith("/workspaces") && method === "POST") return jsonResponse({ path: "accounts/1/containers/10/workspaces/20" });
      if (target.endsWith("/triggers") && method === "GET") return jsonResponse({ trigger: [] });
      if (target.endsWith("/triggers") && method === "POST") return jsonResponse({ triggerId: "30" });
      if (target.endsWith("/tags") && method === "GET") return jsonResponse({ tag: [] });
      if (target.endsWith("/tags") && method === "POST") return jsonResponse({ error: "denied" }, 403);
      if (target.endsWith("/workspaces/20") && method === "DELETE") return new Response(null, { status: 204 });
      return jsonResponse({}, 404);
    });

    await expect(installMimosaasGtmTag({
      accessToken: "access-token",
      container: { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainNames: [], recommended: false },
      trackingId: `mtk_${"a".repeat(32)}`,
      trackingSecret: `mts_${"b".repeat(43)}`,
      trackerOrigin: "https://app.example",
    })).rejects.toMatchObject({ code: "MIMOSAAS_GTM_PROVIDER_ERROR", status: 403 });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces/20"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

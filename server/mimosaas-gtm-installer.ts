import { assertProductionTokenEncryptionConfigured, decryptString, encryptString } from "./utils/tokenVault";

const GTM_API_ROOT = "https://tagmanager.googleapis.com/tagmanager/v2";
const GTM_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;
const GTM_MAX_PAGES = 20;

export type MimosaasGtmContainer = {
  path: string;
  name: string;
  publicId: string;
  domainNames: string[];
  recommended: boolean;
};

type GtmAuthorizationPayload = {
  actorId: string;
  campaignId: string;
  connectionId: string;
  accessToken: string;
  expiresAt: number;
  containers: MimosaasGtmContainer[];
};

const normalizeHostname = (value: string): string => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\.$/, "");
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
};

const gtmRequest = async <T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${GTM_API_ROOT}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw Object.assign(new Error("Google Tag Manager request failed"), {
      code: "MIMOSAAS_GTM_PROVIDER_ERROR",
      status: response.status,
    });
  }
  return body as T;
};

const listGtmPages = async <T>(
  accessToken: string,
  path: string,
  collectionKey: string,
): Promise<T[]> => {
  const rows: T[] = [];
  let pageToken = "";
  for (let page = 0; page < GTM_MAX_PAGES; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const pagePath = pageToken ? `${path}${separator}pageToken=${encodeURIComponent(pageToken)}` : path;
    const body = await gtmRequest<Record<string, unknown>>(accessToken, pagePath);
    const pageRows = body[collectionKey];
    if (Array.isArray(pageRows)) rows.push(...pageRows as T[]);
    pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : "";
    if (!pageToken) return rows;
  }
  throw Object.assign(new Error("Google Tag Manager result limit exceeded"), {
    code: "MIMOSAAS_GTM_RESULT_LIMIT",
  });
};

export const listMimosaasGtmContainers = async (
  accessToken: string,
  websiteUrl: string,
): Promise<MimosaasGtmContainer[]> => {
  const websiteHostname = normalizeHostname(new URL(websiteUrl).hostname);
  const accounts = await listGtmPages<any>(accessToken, "accounts", "account");
  const containers: MimosaasGtmContainer[] = [];

  for (const account of accounts) {
    const accountPath = String(account?.path || "");
    if (!/^accounts\/[^/]+$/.test(accountPath)) continue;
    const accountContainers = await listGtmPages<any>(accessToken, `${accountPath}/containers`, "container");
    for (const container of accountContainers) {
      const path = String(container?.path || "");
      const publicId = String(container?.publicId || "");
      const usageContext = Array.isArray(container?.usageContext) ? container.usageContext.map(String) : [];
      if (!/^accounts\/[^/]+\/containers\/[^/]+$/.test(path) || !/^GTM-[A-Z0-9-]+$/i.test(publicId)) continue;
      if (!usageContext.includes("web")) continue;
      const domainNames = Array.isArray(container?.domainName)
        ? container.domainName.map(String).map((value: string) => value.trim()).filter(Boolean).slice(0, 50)
        : [];
      containers.push({
        path,
        name: String(container?.name || publicId).slice(0, 255),
        publicId,
        domainNames,
        recommended: domainNames.some((domain: string) => normalizeHostname(domain) === websiteHostname),
      });
    }
  }

  return containers.slice(0, 200);
};

export const buildMimosaasGtmAuthorization = (input: {
  actorId: string;
  campaignId: string;
  connectionId: string;
  accessToken: string;
  containers: MimosaasGtmContainer[];
  now?: number;
}) => {
  assertProductionTokenEncryptionConfigured();
  return encryptString(JSON.stringify({
    actorId: input.actorId,
    campaignId: input.campaignId,
    connectionId: input.connectionId,
    accessToken: input.accessToken,
    expiresAt: (input.now ?? Date.now()) + GTM_AUTHORIZATION_TTL_MS,
    containers: input.containers,
  } satisfies GtmAuthorizationPayload));
};

export const resolveMimosaasGtmAuthorization = (input: {
  authorization: unknown;
  actorId: string;
  campaignId: string;
  connectionId: string;
  containerPath: string;
  now?: number;
}): { accessToken: string; container: MimosaasGtmContainer } | null => {
  assertProductionTokenEncryptionConfigured();
  let pending: GtmAuthorizationPayload;
  try {
    pending = JSON.parse(decryptString(input.authorization as any));
  } catch {
    return null;
  }
  if (
    pending.actorId !== input.actorId ||
    pending.campaignId !== input.campaignId ||
    pending.connectionId !== input.connectionId ||
    !pending.accessToken ||
    !Number.isFinite(pending.expiresAt) ||
    pending.expiresAt < (input.now ?? Date.now()) ||
    !Array.isArray(pending.containers)
  ) return null;
  const container = pending.containers.find((candidate) => candidate.path === input.containerPath);
  return container ? { accessToken: pending.accessToken, container } : null;
};

const findUniqueNamedEntity = (entities: any[], name: string, kind: string): any | null => {
  const matches = entities.filter((entity) => String(entity?.name || "") === name);
  if (matches.length > 1) {
    throw Object.assign(new Error(`Multiple Mimosaas ${kind} records already exist`), {
      code: "MIMOSAAS_GTM_DUPLICATE_ENTITY",
    });
  }
  return matches[0] || null;
};

export const installMimosaasGtmTag = async (input: {
  accessToken: string;
  container: MimosaasGtmContainer;
  trackingId: string;
  trackingSecret: string;
  trackerOrigin: string;
}): Promise<Record<string, unknown>> => {
  if (!/^mtk_[a-f0-9]{32}$/.test(input.trackingId) || !/^mts_[A-Za-z0-9_-]{43}$/.test(input.trackingSecret)) {
    throw Object.assign(new Error("Invalid Mimosaas Tracking credentials"), { code: "MIMOSAAS_GTM_INVALID_CREDENTIALS" });
  }
  const trackerOrigin = new URL(input.trackerOrigin).origin;
  const identity = input.trackingId;
  const workspaceName = `Mimosaas Tracking ${identity} ${Date.now()}`;
  const triggerName = `Mimosaas Tracking - All Pages - ${identity}`;
  const tagName = `Mimosaas Tracking - ${identity}`;
  let workspacePath = "";
  let workspaceConsumed = false;

  try {
    const workspace = await gtmRequest<any>(input.accessToken, `${input.container.path}/workspaces`, {
      method: "POST",
      body: JSON.stringify({ name: workspaceName, description: "Managed by Mimosaas" }),
    });
    workspacePath = String(workspace?.path || "");
    if (!/^accounts\/[^/]+\/containers\/[^/]+\/workspaces\/[^/]+$/.test(workspacePath)) {
      throw Object.assign(new Error("Google Tag Manager did not create a valid workspace"), { code: "MIMOSAAS_GTM_INVALID_WORKSPACE" });
    }

    const triggers = await listGtmPages<any>(input.accessToken, `${workspacePath}/triggers`, "trigger");
    const existingTrigger = findUniqueNamedEntity(triggers, triggerName, "trigger");
    const trigger = existingTrigger
      ? await gtmRequest<any>(input.accessToken, String(existingTrigger.path), {
          method: "PUT",
          body: JSON.stringify({ name: triggerName, type: "pageview", fingerprint: existingTrigger.fingerprint }),
        })
      : await gtmRequest<any>(input.accessToken, `${workspacePath}/triggers`, {
          method: "POST",
          body: JSON.stringify({ name: triggerName, type: "pageview" }),
        });
    const triggerId = String(trigger?.triggerId || "");
    if (!triggerId) throw Object.assign(new Error("Google Tag Manager trigger creation failed"), { code: "MIMOSAAS_GTM_INVALID_TRIGGER" });

    const trackerUrl = `${trackerOrigin}/api/mimosaas-tracking/tracker.js`;
    const installationCode = `<script>(function(){var s=document.createElement("script");s.async=true;s.src=${JSON.stringify(trackerUrl)};s.setAttribute("data-tracking-id",${JSON.stringify(input.trackingId)});s.setAttribute("data-tracking-secret",${JSON.stringify(input.trackingSecret)});(document.head||document.documentElement).appendChild(s);}());</script>`;
    const tags = await listGtmPages<any>(input.accessToken, `${workspacePath}/tags`, "tag");
    const existingTag = findUniqueNamedEntity(tags, tagName, "tag");
    const tagBody = {
      name: tagName,
      type: "html",
      parameter: [
        { type: "template", key: "html", value: installationCode },
        { type: "boolean", key: "supportDocumentWrite", value: "false" },
      ],
      firingTriggerId: [triggerId],
      ...(existingTag?.fingerprint ? { fingerprint: existingTag.fingerprint } : {}),
    };
    const tag = existingTag
      ? await gtmRequest<any>(input.accessToken, String(existingTag.path), { method: "PUT", body: JSON.stringify(tagBody) })
      : await gtmRequest<any>(input.accessToken, `${workspacePath}/tags`, { method: "POST", body: JSON.stringify(tagBody) });
    if (!tag?.tagId) throw Object.assign(new Error("Google Tag Manager tag creation failed"), { code: "MIMOSAAS_GTM_INVALID_TAG" });

    const versionResult = await gtmRequest<any>(input.accessToken, `${workspacePath}:create_version`, {
      method: "POST",
      body: JSON.stringify({ name: `Mimosaas Tracking ${identity}`, notes: "Managed by Mimosaas" }),
    });
    workspaceConsumed = true;
    const versionPath = String(versionResult?.containerVersion?.path || "");
    if (versionResult?.compilerError || versionResult?.syncStatus?.mergeConflict || !versionPath) {
      throw Object.assign(new Error("Google Tag Manager could not create a publishable version"), { code: "MIMOSAAS_GTM_VERSION_FAILED" });
    }

    const publishResult = await gtmRequest<any>(input.accessToken, `${versionPath}:publish`, { method: "POST" });
    if (publishResult?.compilerError) {
      throw Object.assign(new Error("Google Tag Manager reported a compiler error"), { code: "MIMOSAAS_GTM_PUBLISH_FAILED" });
    }

    return {
      containerPath: input.container.path,
      containerPublicId: input.container.publicId,
      containerName: input.container.name,
      tagPath: String(tag.path || ""),
      versionPath,
      publishedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (workspacePath && !workspaceConsumed) {
      await gtmRequest(input.accessToken, workspacePath, { method: "DELETE" }).catch(() => undefined);
    }
    throw error;
  }
};

export const MIMOSAAS_BROWSER_TRACKER_VERSION = "1.0.0";

export const MIMOSAAS_BROWSER_TRACKER_SOURCE = String.raw`(function () {
  "use strict";
  if (window.__mimosaasTrackerV1) return;
  window.__mimosaasTrackerV1 = true;

  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      if (scripts[i].getAttribute("data-tracking-id")) { script = scripts[i]; break; }
    }
  }
  if (!script) return;

  var trackingId = String(script.getAttribute("data-tracking-id") || "");
  var trackingSecret = String(script.getAttribute("data-tracking-secret") || "");
  if (!/^mtk_[a-f0-9]{32}$/.test(trackingId) || !/^mts_[A-Za-z0-9_-]{43}$/.test(trackingSecret)) return;

  var apiOrigin;
  try { apiOrigin = new URL(script.src, window.location.href).origin; } catch (_error) { return; }
  var verificationEndpoint = apiOrigin + "/api/mimosaas-tracking/installations/verify";
  var eventEndpoint = apiOrigin + "/api/mimosaas-tracking/events";
  var sessionTimeoutMs = 30 * 60 * 1000;

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (_error) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (_error) {}
  }
  function randomId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return prefix + window.crypto.randomUUID();
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      var value = "";
      for (var i = 0; i < bytes.length; i += 1) value += bytes[i].toString(16).padStart(2, "0");
      return prefix + value;
    }
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function pageUrl() {
    var value = String(window.location.href || "");
    try {
      var parsed = new URL(value);
      return (parsed.protocol === "http:" || parsed.protocol === "https:") && value.length <= 2048 ? value : null;
    } catch (_error) { return null; }
  }
  function safeReferrer() {
    var value = String(document.referrer || "");
    if (!value || value.length > 2048) return null;
    try {
      var parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : null;
    } catch (_error) { return null; }
  }
  function visitorId() {
    var key = "mimosaas_visitor_id";
    var value = storageGet(key);
    if (!value || value.length > 128) {
      value = randomId("mv_");
      storageSet(key, value);
    }
    return value;
  }
  function sessionId() {
    var key = "mimosaas_session_" + trackingId;
    var now = Date.now();
    var session = null;
    try { session = JSON.parse(storageGet(key) || "null"); } catch (_error) {}
    if (!session || typeof session.id !== "string" || session.id.length > 128 || !Number.isFinite(session.lastActivity) || now - session.lastActivity > sessionTimeoutMs) {
      session = { id: randomId("ms_"), lastActivity: now };
    } else {
      session.lastActivity = now;
    }
    storageSet(key, JSON.stringify(session));
    return session.id;
  }
  function parameter(url, name, maxLength) {
    var value = url.searchParams.get(name);
    return value ? value.slice(0, maxLength) : null;
  }
  function eventPayload(eventName) {
    var url = pageUrl();
    if (!url || !/^[A-Za-z0-9_.-]{1,100}$/.test(eventName)) return null;
    var parsed = new URL(url);
    return {
      trackingId: trackingId,
      trackingSecret: trackingSecret,
      eventId: randomId("me_"),
      eventTime: new Date().toISOString(),
      anonymousVisitorId: visitorId(),
      sessionId: sessionId(),
      eventName: eventName,
      url: url,
      referrer: safeReferrer(),
      utmSource: parameter(parsed, "utm_source", 255),
      utmMedium: parameter(parsed, "utm_medium", 255),
      utmCampaign: parameter(parsed, "utm_campaign", 255),
      utmTerm: parameter(parsed, "utm_term", 255),
      utmContent: parameter(parsed, "utm_content", 255),
      gclid: parameter(parsed, "gclid", 512)
    };
  }
  function postJson(endpoint, payload) {
    return window.fetch(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      referrerPolicy: "strict-origin-when-cross-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error("request failed");
      return response.json();
    });
  }
  function sendEvent(eventName) {
    var payload = eventPayload(eventName);
    if (!payload) return;
    postJson(eventEndpoint, payload).catch(function () {
      window.setTimeout(function () { postJson(eventEndpoint, payload).catch(function () {}); }, 2000);
    });
  }
  function beginTracking() {
    sendEvent("page_view");
    var activeMs = 0;
    var visibleStartedAt = document.visibilityState === "hidden" ? null : Date.now();
    var timer = null;
    var sent = false;
    function scheduleEngagement() {
      if (sent || visibleStartedAt === null) return;
      timer = window.setTimeout(function () {
        sent = true;
        sendEvent("user_engagement");
      }, Math.max(0, 10000 - activeMs));
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        if (visibleStartedAt !== null) activeMs += Date.now() - visibleStartedAt;
        visibleStartedAt = null;
        if (timer !== null) window.clearTimeout(timer);
      } else if (!sent) {
        visibleStartedAt = Date.now();
        scheduleEngagement();
      }
    });
    scheduleEngagement();
  }

  var url = pageUrl();
  if (!url) return;
  postJson(verificationEndpoint, { trackingId: trackingId, trackingSecret: trackingSecret, url: url })
    .then(function (result) {
      if (!result || typeof result.newlyVerified !== "boolean") return;
      if (!result.newlyVerified) beginTracking();
    })
    .catch(function () {});
})();`;

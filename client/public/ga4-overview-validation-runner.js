(function () {
  "use strict";

  var VERSION = "2026-07-03.2";
  var DEFAULT_DATE_RANGE = "30days";
  var STORAGE_PREFIX = "ga4-overview-validation:";

  function requireValue(value, name) {
    if (value === undefined || value === null || value === "") {
      throw new Error(name + " is required");
    }
    return String(value);
  }

  function numberOrNull(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function money(value) {
    var n = numberOrNull(value);
    return n === null ? null : Math.round(n * 100) / 100;
  }

  function closeMoney(a, b) {
    return Math.abs(Number(a || 0) - Number(b || 0)) < 0.01;
  }

  function firstNumber(data, keys) {
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = data && data[key];
      var parsed = numberOrNull(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  function rowsOf(data) {
    if (Array.isArray(data)) return data;
    var keys = ["sources", "data", "rows", "breakdown", "spendBreakdown", "revenueBreakdown", "items"];
    for (var i = 0; i < keys.length; i++) {
      var value = data && data[keys[i]];
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  function sourceId(row) {
    return row && (row.id || row.sourceId || row.revenueSourceId || row.spendSourceId || row.source_id || null);
  }

  function sourceType(row) {
    return String(row && (row.type || row.sourceType || row.source_type || row.platform || "") || "").toLowerCase();
  }

  function sourceAmount(row, type) {
    var keys = type === "spend"
      ? ["spend", "amount", "totalSpend", "total", "cost", "value"]
      : ["revenue", "amount", "totalRevenue", "total", "value"];
    for (var i = 0; i < keys.length; i++) {
      var parsed = numberOrNull(row && row[keys[i]]);
      if (parsed !== null) return money(parsed);
    }
    return null;
  }

  function sumRows(rows, keys) {
    var sum = rows.reduce(function (total, row) {
      for (var i = 0; i < keys.length; i++) {
        var parsed = numberOrNull(row && row[keys[i]]);
        if (parsed !== null) return total + parsed;
      }
      return total;
    }, 0);
    return money(sum);
  }

  async function fetchJson(name, url, options) {
    try {
      var res = await fetch(url, Object.assign({ credentials: "include", cache: "no-store" }, options || {}));
      var data = null;
      try { data = await res.json(); } catch (_) {}
      return {
        name: name,
        pass: res.ok,
        status: res.status,
        data: data,
        error: data && (data.error || data.message) || null,
        requiresReauthorization: data && data.requiresReauthorization === true,
        noCompletedWindow: data && data.noCompletedWindow === true
      };
    } catch (error) {
      return {
        name: name,
        pass: false,
        status: null,
        data: null,
        error: String(error && error.message || error),
        requiresReauthorization: false,
        noCompletedWindow: false
      };
    }
  }

  function endpointStatus(results) {
    return results.map(function (result) {
      return {
        endpoint: result.name,
        pass: result.pass,
        status: result.status,
        error: result.error,
        requiresReauthorization: result.requiresReauthorization || undefined,
        noCompletedWindow: result.noCompletedWindow || undefined
      };
    });
  }

  function endpointMap(results) {
    return results.reduce(function (map, result) {
      map[result.name] = result;
      return map;
    }, {});
  }

  function buildSourceSummary(rows, type, targetSourceId) {
    var ids = rows.map(sourceId).filter(Boolean);
    var googleSheetsRows = rows.filter(function (row) { return sourceType(row).indexOf("google") !== -1; });
    var target = targetSourceId
      ? rows.find(function (row) { return sourceId(row) === targetSourceId; }) || null
      : null;

    return {
      sourceCount: rows.length,
      sourceIds: ids,
      googleSheetsSourceCount: googleSheetsRows.length,
      targetPresent: targetSourceId ? !!target : undefined,
      targetAmount: target ? sourceAmount(target, type) : undefined,
      targetType: target ? sourceType(target) || null : undefined
    };
  }

  function buildBreakdownTarget(rows, targetSourceId, type) {
    if (!targetSourceId) return undefined;
    var target = rows.find(function (row) {
      return sourceId(row) === targetSourceId;
    }) || null;
    return {
      targetInBreakdown: !!target,
      targetBreakdownAmount: target ? sourceAmount(target, type) : null
    };
  }

  function buildTotals(byName) {
    var revenueBreakdownRows = rowsOf(byName.revenueBreakdown && byName.revenueBreakdown.data);
    var spendBreakdownRows = rowsOf(byName.spendBreakdown && byName.spendBreakdown.data);

    var revenueToDate = money(firstNumber(byName.revenueToDate && byName.revenueToDate.data, ["totalRevenue", "revenue", "total", "amount"]));
    var spendToDate = money(firstNumber(byName.spendToDate && byName.spendToDate.data, ["totalSpend", "spend", "total", "amount"]));

    var revenueBreakdownTotal = money(firstNumber(byName.revenueBreakdown && byName.revenueBreakdown.data, ["totalRevenue", "revenue", "total", "amount"]));
    if (revenueBreakdownTotal === null) {
      revenueBreakdownTotal = sumRows(revenueBreakdownRows, ["revenue", "amount", "totalRevenue", "total", "value"]);
    }

    var spendBreakdownTotal = money(firstNumber(byName.spendBreakdown && byName.spendBreakdown.data, ["totalSpend", "spend", "total", "amount"]));
    if (spendBreakdownTotal === null) {
      spendBreakdownTotal = sumRows(spendBreakdownRows, ["spend", "amount", "totalSpend", "total", "cost", "value"]);
    }

    return {
      revenueToDate: revenueToDate,
      revenueBreakdownTotal: revenueBreakdownTotal,
      spendToDate: spendToDate,
      spendBreakdownTotal: spendBreakdownTotal
    };
  }

  async function snapshot(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = config.propertyId ? String(config.propertyId) : null;
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var includeGa4 = config.includeGa4 !== false && !!propertyId;
    var targetSourceId = config.targetSourceId ? String(config.targetSourceId) : null;

    var requests = [
      fetchJson("revenueToDate", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-to-date"),
      fetchJson("revenueBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-breakdown"),
      fetchJson("revenueSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources"),
      fetchJson("spendToDate", "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-to-date"),
      fetchJson("spendBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-breakdown"),
      fetchJson("spendSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-sources")
    ];

    if (includeGa4) {
      requests.push(fetchJson("ga4ToDate", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-to-date?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)));
      requests.push(fetchJson("ga4Breakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-breakdown?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)));
    }

    var results = await Promise.all(requests);
    var byName = endpointMap(results);
    var totals = buildTotals(byName);
    var revenueSources = rowsOf(byName.revenueSources && byName.revenueSources.data);
    var spendSources = rowsOf(byName.spendSources && byName.spendSources.data);
    var revenueBreakdownRows = rowsOf(byName.revenueBreakdown && byName.revenueBreakdown.data);
    var spendBreakdownRows = rowsOf(byName.spendBreakdown && byName.spendBreakdown.data);

    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "snapshot",
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      includeGa4: includeGa4,
      endpointPass: results.every(function (result) { return result.pass; }),
      endpointStatus: endpointStatus(results),
      revenue: Object.assign({
        toDate: totals.revenueToDate,
        breakdownTotal: totals.revenueBreakdownTotal
      }, buildSourceSummary(revenueSources, "revenue", targetSourceId), buildBreakdownTarget(revenueBreakdownRows, targetSourceId, "revenue")),
      spend: Object.assign({
        toDate: totals.spendToDate,
        breakdownTotal: totals.spendBreakdownTotal
      }, buildSourceSummary(spendSources, "spend", targetSourceId), buildBreakdownTarget(spendBreakdownRows, targetSourceId, "spend"))
    };

    if (includeGa4) {
      summary.ga4 = {
        toDatePass: !!(byName.ga4ToDate && byName.ga4ToDate.pass),
        breakdownPass: !!(byName.ga4Breakdown && byName.ga4Breakdown.pass),
        noCompletedWindow: !!(byName.ga4ToDate && byName.ga4ToDate.noCompletedWindow),
        toDateRevenue: money(byName.ga4ToDate && byName.ga4ToDate.data && byName.ga4ToDate.data.totals && byName.ga4ToDate.data.totals.revenue),
        breakdownRevenue: money(byName.ga4Breakdown && byName.ga4Breakdown.data && byName.ga4Breakdown.data.totals && byName.ga4Breakdown.data.totals.revenue)
      };
    }

    return summary;
  }

  function storageKey(label, campaignId) {
    return STORAGE_PREFIX + requireValue(campaignId, "campaignId") + ":" + requireValue(label, "label");
  }

  async function before(label, config) {
    config = Object.assign({}, config || {}, { stage: "before-" + label });
    var result = await snapshot(config);
    var key = storageKey(label, result.campaignId);
    localStorage.setItem(key, JSON.stringify(result));
    result.savedBaselineKey = key;
    result.readyForAction = result.endpointPass;
    console.log(result);
    return result;
  }

  function compareNumberDelta(beforeValue, afterValue, expectedDelta) {
    if (expectedDelta === undefined || expectedDelta === null) return undefined;
    return closeMoney(money(afterValue) - money(beforeValue), money(expectedDelta));
  }

  function compareCountDelta(beforeValue, afterValue, expectedDelta) {
    if (expectedDelta === undefined || expectedDelta === null) return undefined;
    return Number(afterValue) - Number(beforeValue) === Number(expectedDelta);
  }

  async function after(label, config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var key = config.baselineKey || storageKey(label, campaignId);
    var baseline = JSON.parse(localStorage.getItem(key) || "null");
    var targetSourceId = config.targetSourceId || (baseline && (baseline.revenue.targetPresent || baseline.spend.targetPresent) ? null : null);
    var result = await snapshot(Object.assign({}, config, {
      stage: "after-" + label,
      targetSourceId: targetSourceId
    }));

    var checks = {
      baselineFound: !!baseline,
      endpointsPass: result.endpointPass
    };

    if (baseline) {
      checks.revenueDeltaMatchesExpected = compareNumberDelta(baseline.revenue.breakdownTotal, result.revenue.breakdownTotal, config.expectedRevenueDelta);
      checks.spendDeltaMatchesExpected = compareNumberDelta(baseline.spend.breakdownTotal, result.spend.breakdownTotal, config.expectedSpendDelta);
      checks.revenueSourceCountDeltaMatchesExpected = compareCountDelta(baseline.revenue.sourceCount, result.revenue.sourceCount, config.expectedRevenueSourceCountDelta);
      checks.spendSourceCountDeltaMatchesExpected = compareCountDelta(baseline.spend.sourceCount, result.spend.sourceCount, config.expectedSpendSourceCountDelta);

      if (config.expectedRevenueTotal !== undefined && config.expectedRevenueTotal !== null) {
        checks.revenueTotalMatchesExpected = closeMoney(result.revenue.breakdownTotal, config.expectedRevenueTotal);
      }
      if (config.expectedSpendTotal !== undefined && config.expectedSpendTotal !== null) {
        checks.spendTotalMatchesExpected = closeMoney(result.spend.breakdownTotal, config.expectedSpendTotal);
      }
      if (config.expectRevenueUnchanged === true) {
        checks.revenueUnchanged = closeMoney(result.revenue.breakdownTotal, baseline.revenue.breakdownTotal) && result.revenue.sourceCount === baseline.revenue.sourceCount;
      }
      if (config.expectSpendUnchanged === true) {
        checks.spendUnchanged = closeMoney(result.spend.breakdownTotal, baseline.spend.breakdownTotal) && result.spend.sourceCount === baseline.spend.sourceCount;
      }
    }

    if (config.targetSourceId) {
      if (config.targetFamily === "revenue") {
        checks.targetRevenueSourceStateMatches = config.targetShouldExist === undefined ? undefined : result.revenue.targetPresent === config.targetShouldExist;
        checks.targetRevenueBreakdownStateMatches = config.targetShouldExist === undefined ? undefined : result.revenue.targetInBreakdown === config.targetShouldExist;
      } else if (config.targetFamily === "spend") {
        checks.targetSpendSourceStateMatches = config.targetShouldExist === undefined ? undefined : result.spend.targetPresent === config.targetShouldExist;
        checks.targetSpendBreakdownStateMatches = config.targetShouldExist === undefined ? undefined : result.spend.targetInBreakdown === config.targetShouldExist;
      }
    }

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});

    var summary = {
      runnerVersion: VERSION,
      checkedAt: result.checkedAt,
      stage: result.stage,
      campaignId: result.campaignId,
      propertyId: result.propertyId,
      dateRange: result.dateRange,
      baselineKey: key,
      expected: {
        revenueDelta: config.expectedRevenueDelta,
        spendDelta: config.expectedSpendDelta,
        revenueSourceCountDelta: config.expectedRevenueSourceCountDelta,
        spendSourceCountDelta: config.expectedSpendSourceCountDelta,
        revenueTotal: config.expectedRevenueTotal,
        spendTotal: config.expectedSpendTotal,
        targetSourceId: config.targetSourceId || null,
        targetFamily: config.targetFamily || null,
        targetShouldExist: config.targetShouldExist
      },
      before: baseline ? {
        revenueBreakdownTotal: baseline.revenue.breakdownTotal,
        revenueSourceCount: baseline.revenue.sourceCount,
        spendBreakdownTotal: baseline.spend.breakdownTotal,
        spendSourceCount: baseline.spend.sourceCount
      } : null,
      after: {
        revenueBreakdownTotal: result.revenue.breakdownTotal,
        revenueSourceCount: result.revenue.sourceCount,
        spendBreakdownTotal: result.spend.breakdownTotal,
        spendSourceCount: result.spend.sourceCount,
        targetInRevenueSources: config.targetSourceId ? result.revenue.targetPresent : undefined,
        targetInRevenueBreakdown: config.targetSourceId ? result.revenue.targetInBreakdown : undefined,
        targetInSpendSources: config.targetSourceId ? result.spend.targetPresent : undefined,
        targetInSpendBreakdown: config.targetSourceId ? result.spend.targetInBreakdown : undefined
      },
      endpointStatus: result.endpointStatus,
      checks: effectiveChecks
    };

    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }

  async function refreshSpend(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var sourceId = requireValue(config.sourceId, "sourceId");
    var result = await fetchJson(
      "googleSheetsSpendRefreshRunNow",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-sources/" + encodeURIComponent(sourceId) + "/google-sheets-refresh/run-now",
      { method: "POST" }
    );
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "google-sheets-spend-refresh-run-now",
      campaignId: campaignId,
      sourceId: sourceId,
      pass: result.pass && result.data && result.data.success === true,
      status: result.status,
      success: result.data && result.data.success === true,
      error: result.error
    };
    console.log(summary);
    return summary;
  }

  async function refreshRevenue(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var sourceId = requireValue(config.sourceId, "sourceId");
    var result = await fetchJson(
      "googleSheetsRevenueRefreshRunNow",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources/" + encodeURIComponent(sourceId) + "/google-sheets-refresh/run-now",
      { method: "POST" }
    );
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "google-sheets-revenue-refresh-run-now",
      campaignId: campaignId,
      sourceId: sourceId,
      pass: result.pass && result.data && result.data.success === true,
      status: result.status,
      success: result.data && result.data.success === true,
      error: result.error
    };
    console.log(summary);
    return summary;
  }

  function rowCountOf(data) {
    return rowsOf(data).length;
  }

  function latestDateOf(rows) {
    var latest = null;
    rows.forEach(function (row) {
      var value = row && (row.date || row.dateISO || row.day || row.windowDate || null);
      if (!value) return;
      var normalized = String(value).slice(0, 10);
      if (!latest || normalized > latest) latest = normalized;
    });
    return latest;
  }

  function compactEndpointStatus(result) {
    return {
      endpoint: result.name,
      pass: result.pass,
      status: result.status,
      error: result.error,
      requiresReauthorization: result.requiresReauthorization || undefined,
      noCompletedWindow: result.noCompletedWindow || undefined
    };
  }

  async function fetchBlobStatus(name, url, options) {
    try {
      var res = await fetch(url, Object.assign({ credentials: "include", cache: "no-store" }, options || {}));
      var contentType = res.headers.get("content-type") || null;
      var bytes = null;
      var error = null;
      if (res.ok) {
        try { bytes = (await res.blob()).size; } catch (_) {}
      } else {
        try {
          var data = await res.clone().json();
          error = data && (data.error || data.message) || null;
        } catch (_) {
          try { error = await res.text(); } catch (__) {}
        }
      }
      return { name: name, pass: res.ok, status: res.status, contentType: contentType, bytes: bytes, error: error };
    } catch (error) {
      return { name: name, pass: false, status: null, contentType: null, bytes: null, error: String(error && error.message || error) };
    }
  }

  async function overviewPack(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = requireValue(config.propertyId, "propertyId");
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var dailyDays = config.dailyDays || 30;

    var base = await snapshot({
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      targetSourceId: config.targetSourceId || null
    });

    var extraResults = await Promise.all([
      fetchJson("campaign", "/api/campaigns/" + encodeURIComponent(campaignId)),
      fetchJson("ga4Metrics", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-metrics"),
      fetchJson("ga4Daily", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-daily?days=" + encodeURIComponent(String(dailyDays)) + "&propertyId=" + encodeURIComponent(propertyId)),
      fetchJson("ga4Diagnostics", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-diagnostics?dateRange=" + encodeURIComponent(dateRange) + "&propertyId=" + encodeURIComponent(propertyId)),
      fetchJson("ga4LandingPages", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-landing-pages?dateRange=" + encodeURIComponent(dateRange) + "&propertyId=" + encodeURIComponent(propertyId)),
      fetchJson("ga4ConversionEvents", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-conversion-events?dateRange=" + encodeURIComponent(dateRange) + "&propertyId=" + encodeURIComponent(propertyId))
    ]);

    var extraByName = endpointMap(extraResults);
    var dailyRows = rowsOf(extraByName.ga4Daily && extraByName.ga4Daily.data);
    var landingRows = rowsOf(extraByName.ga4LandingPages && extraByName.ga4LandingPages.data);
    var conversionRows = rowsOf(extraByName.ga4ConversionEvents && extraByName.ga4ConversionEvents.data);
    var allStatuses = base.endpointStatus.concat(extraResults.map(compactEndpointStatus));
    var endpointPass = allStatuses.every(function (status) { return status.pass === true; });
    var noReauthorizationRequired = allStatuses.every(function (status) { return status.requiresReauthorization !== true; });
    var dailyData = extraByName.ga4Daily && extraByName.ga4Daily.data || {};
    var requireFreshDaily = config.requireFreshDaily !== false;

    var checks = {
      endpointsPass: endpointPass,
      noReauthorizationRequired: noReauthorizationRequired,
      ga4ToDateEndpointPasses: !!(base.ga4 && base.ga4.toDatePass),
      ga4BreakdownEndpointPasses: !!(base.ga4 && base.ga4.breakdownPass),
      financialEndpointsPass: base.endpointStatus.filter(function (status) {
        return /^(revenue|spend)/.test(status.endpoint);
      }).every(function (status) { return status.pass === true; }),
      sourceCountsAreNonNegative: base.revenue.sourceCount >= 0 && base.spend.sourceCount >= 0,
      dailyEndpointPasses: !!(extraByName.ga4Daily && extraByName.ga4Daily.pass),
      dailyNotStale: requireFreshDaily ? dailyData.refreshIsStale !== true : undefined,
      landingPagesEndpointPasses: !!(extraByName.ga4LandingPages && extraByName.ga4LandingPages.pass),
      conversionEventsEndpointPasses: !!(extraByName.ga4ConversionEvents && extraByName.ga4ConversionEvents.pass)
    };

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});

    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "ga4-overview-automated-pack",
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      dailyDays: dailyDays,
      endpointStatus: allStatuses,
      financial: {
        revenueToDate: base.revenue.toDate,
        revenueBreakdownTotal: base.revenue.breakdownTotal,
        revenueSourceCount: base.revenue.sourceCount,
        spendToDate: base.spend.toDate,
        spendBreakdownTotal: base.spend.breakdownTotal,
        spendSourceCount: base.spend.sourceCount
      },
      ga4: {
        noCompletedWindow: !!(base.ga4 && base.ga4.noCompletedWindow),
        toDateRevenue: base.ga4 ? base.ga4.toDateRevenue : null,
        breakdownRevenue: base.ga4 ? base.ga4.breakdownRevenue : null,
        dailyRowCount: dailyRows.length,
        dailyLatestDate: latestDateOf(dailyRows),
        dataThroughDate: dailyData.dataThroughDate || null,
        refreshIsStale: dailyData.refreshIsStale === true,
        landingPageRowCount: landingRows.length,
        conversionEventRowCount: conversionRows.length
      },
      caveats: [
        "Automated endpoint validation only; it does not inspect rendered UI pixels or prove inbox email delivery.",
        "Provider data can change after GA4 processes delayed events; compare checkedAt timestamps when reviewing evidence.",
        "A passing pack is not clean certification for untested source families or future report/email deliveries."
      ],
      checks: effectiveChecks
    };

    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }

  async function reportPack(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var platformType = config.platformType || "google_analytics";
    var reportId = config.reportId ? String(config.reportId) : null;
    var createSnapshot = config.createSnapshot === true;
    var sendTest = config.sendTest === true;

    var reportsResult = await fetchJson("reports", "/api/platforms/" + encodeURIComponent(platformType) + "/reports?campaignId=" + encodeURIComponent(campaignId));
    var reports = Array.isArray(reportsResult.data) ? reportsResult.data : [];
    var report = reportId
      ? reports.find(function (row) { return String(row && row.id) === reportId; }) || null
      : reports.find(function (row) { return String(row && row.reportType || "").toLowerCase() === "overview"; }) || reports[0] || null;

    reportId = report ? String(report.id) : reportId;
    var snapshotResult = null;
    var snapshotsResult = null;
    var pdfResult = null;
    var sendResult = null;
    var sendEventsResult = null;
    var snapshotId = null;

    if (reportId && createSnapshot) {
      snapshotResult = await fetchJson("createSnapshot", "/api/platforms/" + encodeURIComponent(platformType) + "/reports/" + encodeURIComponent(reportId) + "/snapshots", { method: "POST" });
      snapshotId = snapshotResult.data && snapshotResult.data.snapshot && snapshotResult.data.snapshot.id || null;
    }

    if (reportId) {
      snapshotsResult = await fetchJson("snapshots", "/api/platforms/" + encodeURIComponent(platformType) + "/reports/" + encodeURIComponent(reportId) + "/snapshots");
      if (!snapshotId) {
        var snapshots = snapshotsResult.data && Array.isArray(snapshotsResult.data.snapshots) ? snapshotsResult.data.snapshots : [];
        snapshotId = snapshots[0] && snapshots[0].id || null;
      }
    }

    if (snapshotId && config.checkPdf !== false) {
      pdfResult = await fetchBlobStatus("snapshotPdf", "/api/report-snapshots/" + encodeURIComponent(snapshotId) + "/pdf");
    }

    if (reportId && sendTest) {
      sendResult = await fetchJson("sendTest", "/api/platforms/" + encodeURIComponent(platformType) + "/reports/" + encodeURIComponent(reportId) + "/send-test", { method: "POST" });
      sendEventsResult = await fetchJson("sendEvents", "/api/platforms/" + encodeURIComponent(platformType) + "/reports/" + encodeURIComponent(reportId) + "/send-events");
    }

    var checks = {
      reportsEndpointPasses: reportsResult.pass,
      reportResolved: !!report,
      snapshotCreatedWhenRequested: createSnapshot ? !!(snapshotResult && snapshotResult.pass && snapshotId) : undefined,
      snapshotsEndpointPasses: reportId ? !!(snapshotsResult && snapshotsResult.pass) : undefined,
      pdfEndpointPasses: snapshotId && config.checkPdf !== false ? !!(pdfResult && pdfResult.pass) : undefined,
      pdfLooksLikePdf: snapshotId && config.checkPdf !== false ? !!(pdfResult && /application\/pdf/i.test(String(pdfResult.contentType || "")) && Number(pdfResult.bytes || 0) > 0) : undefined,
      sendTestPasses: sendTest ? !!(sendResult && sendResult.pass && sendResult.data && sendResult.data.success === true) : undefined,
      sendEventsEndpointPasses: sendTest ? !!(sendEventsResult && sendEventsResult.pass) : undefined
    };

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});

    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "ga4-overview-report-automated-pack",
      campaignId: campaignId,
      platformType: platformType,
      reportId: reportId || null,
      reportType: report ? report.reportType || null : null,
      reportName: report ? report.name || report.reportName || null : null,
      createSnapshot: createSnapshot,
      sendTest: sendTest,
      snapshotId: snapshotId || null,
      endpointStatus: [reportsResult, snapshotResult, snapshotsResult, pdfResult, sendResult, sendEventsResult]
        .filter(Boolean)
        .map(function (result) {
          return {
            endpoint: result.name,
            pass: result.pass,
            status: result.status,
            contentType: result.contentType || undefined,
            bytes: result.bytes || undefined,
            error: result.error || null
          };
        }),
      caveats: [
        "This pack proves report API/snapshot/PDF availability only; browser-visible PDF value inspection remains external unless separately reviewed.",
        "sendTest=true sends a real test email and still requires provider delivery/inbox evidence before delivery is certified."
      ],
      checks: effectiveChecks
    };

    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }
  function help() {
    var examples = [
      "await import('/ga4-overview-validation-runner.js?v=2026-07-03.2')",
      "await GA4OverviewValidation.overviewPack({ campaignId, propertyId })",
      "await GA4OverviewValidation.reportPack({ campaignId, reportId, createSnapshot: true })",
      "await GA4OverviewValidation.before('2g-tab-add', { campaignId, propertyId })",
      "await GA4OverviewValidation.after('2g-tab-add', { campaignId, propertyId, expectedSpendDelta: 123.45, expectedSpendSourceCountDelta: 1 })",
      "await GA4OverviewValidation.refreshSpend({ campaignId, sourceId })",
      "await GA4OverviewValidation.after('2g-delete', { campaignId, propertyId, targetFamily: 'spend', targetSourceId: sourceId, targetShouldExist: false, expectedSpendDelta: -123.45, expectedSpendSourceCountDelta: -1 })"
    ];
    console.table(examples.map(function (example, index) { return { step: index + 1, example: example }; }));
    return { runnerVersion: VERSION, examples: examples };
  }

  window.GA4OverviewValidation = {
    version: VERSION,
    snapshot: snapshot,
    before: before,
    after: after,
    refreshSpend: refreshSpend,
    refreshRevenue: refreshRevenue,
    overviewPack: overviewPack,
    reportPack: reportPack,
    help: help
  };

  console.log("GA4OverviewValidation loaded", { version: VERSION });
})();

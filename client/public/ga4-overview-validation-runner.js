(function () {
  "use strict";

  var VERSION = "2026-07-04.5";
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

  function objectValue(value) {
    if (!value) return {};
    if (typeof value === "string") {
      try {
        var parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (_) {
        return {};
      }
    }
    return typeof value === "object" ? value : {};
  }

  function mappingConfig(row) {
    return objectValue(row && (row.mappingConfig || row.mapping_config || row.config || row.sourceConfig || row.source_config || row.mapping));
  }

  function firstPresent(row, keys) {
    var mapping = mappingConfig(row);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (mapping[key] !== undefined && mapping[key] !== null && mapping[key] !== "") return mapping[key];
      if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
    }
    return null;
  }

  function arrayValues(value) {
    if (Array.isArray(value)) return value.map(function (item) { return String(item); });
    if (value === undefined || value === null || value === "") return [];
    return [String(value)];
  }

  function sortedValues(value) {
    return arrayValues(value).slice().sort();
  }

  function sourceDisplayName(row) {
    return row && (row.displayName || row.name || row.label || row.sourceName || row.fileName || null);
  }

  function sourceActive(row) {
    if (!row) return false;
    if (row.active === false || row.isActive === false) return false;
    if (String(row.status || "").toLowerCase() === "inactive") return false;
    return true;
  }

  function googleSheetsMappingSummary(row, includeDetails) {
    var mapping = mappingConfig(row);
    var keys = Object.keys(mapping);
    var tabName = firstPresent(row, ["tabName", "sheetName", "worksheetName", "selectedTabName", "sheetTitle"]);
    var dateColumn = firstPresent(row, ["dateColumn", "selectedDateColumn"]);
    var campaignColumn = firstPresent(row, ["campaignColumn", "campaignIdentifierColumn", "campaignField"]);
    var campaignValues = firstPresent(row, ["campaignValues", "selectedCampaignValues", "campaignValue"]);
    var spreadsheetId = firstPresent(row, ["spreadsheetId", "googleSpreadsheetId", "sheetId"]);
    var rowCount = firstNumber(mapping, ["sheetRowCount", "csvRowCount", "rowCount", "storedRowCount"]);
    var storedRows = firstPresent(row, ["sheetStoredRows", "csvStoredSpendRows", "csvStoredRevenueRows", "storedRows"]);

    var summary = {
      hasMappingConfig: keys.length > 0,
      mappingKeyCount: keys.length,
      spreadsheetIdPresent: !!spreadsheetId,
      tabNamePresent: !!tabName,
      dateColumnPresent: !!dateColumn,
      campaignColumnPresent: !!campaignColumn,
      campaignValueCount: arrayValues(campaignValues).length,
      rowCount: rowCount,
      storedRowsPresent: Array.isArray(storedRows) ? storedRows.length > 0 : !!storedRows
    };

    if (includeDetails === true) {
      summary.tabName = tabName;
      summary.dateColumn = dateColumn;
      summary.campaignColumn = campaignColumn;
      summary.campaignValues = sortedValues(campaignValues);
    }

    return summary;
  }

  function compareOptional(actual, expected) {
    if (expected === undefined || expected === null) return undefined;
    if (expected === true) return actual !== null && actual !== undefined && actual !== "";
    if (expected === false) return actual === null || actual === undefined || actual === "";
    return String(actual || "") === String(expected);
  }

  function compareOptionalValues(actual, expected) {
    if (expected === undefined || expected === null) return undefined;
    var actualValues = sortedValues(actual);
    var expectedValues = sortedValues(expected);
    return expectedValues.every(function (value) { return actualValues.indexOf(value) !== -1; });
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
  async function sourceDamageInventory(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var result = await fetchJson(
      "sourceDamageInventory",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"
    );
    var data = result.data || {};
    var findings = data.findings || {};
    var summary = {
      runnerVersion: VERSION,
      checkedAt: data.checkedAt || new Date().toISOString(),
      stage: config.stage || "ga4-overview-source-damage-inventory",
      campaignId: campaignId,
      endpoint: {
        pass: result.pass,
        status: result.status,
        error: result.error || null
      },
      readonly: data.readonly === true,
      inventoryPass: data.overallPass === true,
      summary: data.summary || null,
      findings: {
        orphanRevenueRecordGroups: findings.orphanRevenueRecordGroups || [],
        orphanSpendRecordGroups: findings.orphanSpendRecordGroups || [],
        inactiveRevenueSourceRecordGroups: findings.inactiveRevenueSourceRecordGroups || [],
        inactiveSpendSourceRecordGroups: findings.inactiveSpendSourceRecordGroups || [],
        duplicateActiveRevenueSourceGroups: findings.duplicateActiveRevenueSourceGroups || [],
        duplicateActiveSpendSourceGroups: findings.duplicateActiveSpendSourceGroups || [],
        unexpectedRevenuePlatformContextSources: findings.unexpectedRevenuePlatformContextSources || [],
        unexpectedSpendPlatformContextSources: findings.unexpectedSpendPlatformContextSources || []
      },
      certificationImpact: data.certificationImpact || null,
      caveats: data.caveats || []
    };
    summary.overallPass = result.pass && data.success === true && data.overallPass === true && data.readonly === true;
    console.log(summary);
    return summary;
  }
  async function hubspotInventory(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var result = await fetchJson(
      "hubspotInventory",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"
    );
    var data = result.data || {};
    var hubspotFindings = data.hubspotFindings || {};
    var summary = {
      runnerVersion: VERSION,
      checkedAt: data.checkedAt || new Date().toISOString(),
      stage: config.stage || "hubspot-ga4-overview-inventory",
      campaignId: campaignId,
      endpoint: {
        pass: result.pass,
        status: result.status,
        error: result.error || null
      },
      readonly: data.readonly === true,
      inventoryPass: data.hubspotInventoryPass === true,
      hubspotSummary: data.hubspotSummary || null,
      hubspotFindings: {
        activeHubspotSourcesWithZeroRecords: hubspotFindings.activeHubspotSourcesWithZeroRecords || [],
        orphanHubspotRevenueRecordGroups: hubspotFindings.orphanHubspotRevenueRecordGroups || [],
        duplicateActiveHubspotSourceGroups: hubspotFindings.duplicateActiveHubspotSourceGroups || [],
        hubspotGa4ContextMismatchSources: hubspotFindings.hubspotGa4ContextMismatchSources || [],
        hubspotPipelineProxyScopeMismatches: hubspotFindings.hubspotPipelineProxyScopeMismatches || []
      },
      hubspotCertificationImpact: data.hubspotCertificationImpact || null,
      generalInventoryPass: data.overallPass === true,
      generalSummary: data.summary || null,
      caveats: [
        "This HubSpot inventory is read-only and must be run before and after deployed provider lifecycle validation.",
        "It does not create, refresh, delete, clean, recompute, or certify provider behavior."
      ].concat(data.caveats || [])
    };
    summary.overallPass = result.pass && data.success === true && data.readonly === true && data.hubspotInventoryPass === true;
    console.log(summary);
    return summary;
  }
  async function hubspotProvenance(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var result = await fetchJson(
      "hubspotProvenance",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"
    );
    var data = result.data || {};
    var provenance = data.hubspotProvenance || {};
    var activeSources = Array.isArray(provenance.activeSources) ? provenance.activeSources : [];
    var expectedActiveSourceCount = config.expectedActiveSourceCount == null ? 1 : Number(config.expectedActiveSourceCount);
    var expectedPipelineEnabled = typeof config.expectedPipelineEnabled === "boolean" ? config.expectedPipelineEnabled : null;
    var activeSourceCountPass = !Number.isFinite(expectedActiveSourceCount) || activeSources.length === expectedActiveSourceCount;
    var pipelineExpectationPass = expectedPipelineEnabled === null || activeSources.every(function (source) {
      return !!source && !!source.mapping && source.mapping.pipelineEnabled === expectedPipelineEnabled;
    });
    var checks = {
      endpointPass: result.pass,
      readonly: data.readonly === true,
      serverProvenancePass: data.hubspotProvenancePass === true,
      activeSourceCountPass: activeSourceCountPass,
      pipelineExpectationPass: pipelineExpectationPass
    };
    var summary = {
      runnerVersion: VERSION,
      checkedAt: data.checkedAt || new Date().toISOString(),
      stage: config.stage || "hubspot-ga4-overview-provenance",
      campaignId: campaignId,
      endpoint: {
        pass: result.pass,
        status: result.status,
        error: result.error || null
      },
      readonly: data.readonly === true,
      expectedActiveSourceCount: expectedActiveSourceCount,
      expectedPipelineEnabled: expectedPipelineEnabled,
      provenancePass: Object.keys(checks).every(function (key) { return checks[key] === true; }),
      account: provenance.account || null,
      accountPresent: provenance.accountPresent === true,
      activeSources: activeSources,
      connectionMapping: provenance.connectionMapping || null,
      findings: provenance.findings || {},
      findingCount: Number(provenance.findingCount || 0),
      sourceModalEvidenceBoundary: provenance.sourceModalEvidenceBoundary || null,
      checks: checks,
      caveats: [
        "This HubSpot provenance check is read-only and does not refresh, create, edit, delete, clean, or recompute data.",
        "It records endpoint/source-modal data fields, not a screenshot or pixel assertion.",
        "Do not include OAuth tokens or secrets in provenance evidence."
      ].concat(data.caveats || [])
    };
    summary.overallPass = summary.provenancePass;
    console.log(summary);
    return summary;
  }

  function sameStringList(a, b) {
    var left = sortedValues(a);
    var right = sortedValues(b);
    if (left.length !== right.length) return false;
    for (var i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  function optionalMoney(value) {
    if (value === undefined || value === null || value === "") return null;
    return money(value);
  }

  function moneyDelta(afterValue, beforeValue) {
    var after = optionalMoney(afterValue);
    var before = optionalMoney(beforeValue);
    if (after === null || before === null) return null;
    return money(after - before);
  }

  function compactHubspotSource(source) {
    if (!source) return null;
    return {
      sourceId: String(source.sourceId || source.id || ""),
      displayName: source.displayName || source.name || null,
      platformContext: source.platformContext || null,
      isActive: source.isActive === true,
      recordCount: numberOrNull(source.recordCount),
      revenueTotal: optionalMoney(source.revenueTotal),
      mapping: source.mapping || null,
      sourceModalExpected: source.sourceModalExpected || null
    };
  }

  function selectHubspotSource(activeSources, sourceId) {
    if (!Array.isArray(activeSources) || activeSources.length === 0) return null;
    if (sourceId) {
      var wanted = String(sourceId);
      return activeSources.find(function (source) {
        return String(source && (source.sourceId || source.id || "")) === wanted;
      }) || null;
    }
    return activeSources[0] || null;
  }

  function isHubspotPipelineSource(source) {
    return !!(source && source.mapping && source.mapping.pipelineEnabled === true);
  }

  function selectHubspotPipelineSource(activeSources, sourceId) {
    if (!Array.isArray(activeSources) || activeSources.length === 0) return null;
    if (sourceId) return selectHubspotSource(activeSources, sourceId);
    return activeSources.find(isHubspotPipelineSource) || activeSources[0] || null;
  }

  async function hubspotPropagationPoint(config, stage) {
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = config.propertyId ? String(config.propertyId) : null;
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var snapshotResult = await snapshot({
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      includeGa4: config.includeGa4,
      stage: stage + "-snapshot"
    });
    var damageResult = await fetchJson(
      "hubspotSourceDamageInventory",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"
    );
    var data = damageResult.data || {};
    var provenance = data.hubspotProvenance || {};
    var activeSources = Array.isArray(provenance.activeSources) ? provenance.activeSources : [];
    var selectedSource = compactHubspotSource(selectHubspotSource(activeSources, config.sourceId));
    var activeSourceIds = activeSources.map(function (source) {
      return String(source && (source.sourceId || source.id || ""));
    }).filter(Boolean).sort();
    var endpointStatus = snapshotResult.endpointStatus.concat([compactEndpointStatus(damageResult)]);

    return {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: stage,
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      endpointPass: endpointStatus.every(function (status) { return status.pass === true; }),
      endpointStatus: endpointStatus,
      readonly: data.readonly === true,
      inventoryPass: data.hubspotInventoryPass === true,
      provenancePass: data.hubspotProvenancePass === true,
      hubspotSummary: data.hubspotSummary || null,
      hubspotFindings: data.hubspotFindings || {},
      hubspotFindingCount: Number(data.hubspotSummary && data.hubspotSummary.hubspotFindingCount || 0),
      accountPresent: provenance.accountPresent === true,
      activeHubspotSourceIds: activeSourceIds,
      activeSource: selectedSource,
      snapshot: {
        revenueBreakdownTotal: snapshotResult.revenue.breakdownTotal,
        revenueSourceCount: snapshotResult.revenue.sourceCount,
        revenueSourceIds: snapshotResult.revenue.sourceIds || [],
        spendBreakdownTotal: snapshotResult.spend.breakdownTotal,
        spendSourceCount: snapshotResult.spend.sourceCount,
        spendSourceIds: snapshotResult.spend.sourceIds || []
      },
      caveats: [
        "This HubSpot propagation point is read-only and does not refresh, create, edit, delete, clean, recompute, or call provider APIs.",
        "It must be used around a separate controlled HubSpot provider change and the existing scheduler/provider path.",
        "A passing comparison proves only the configured campaign/source/provider-change packet."
      ]
    };
  }

  async function hubspotPropagationBefore(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var label = config.label || "4.8-hubspot-provider-propagation";
    var key = storageKey("hubspot-propagation-" + label, campaignId);
    var expectedActiveSourceCount = config.expectedActiveSourceCount == null ? 1 : Number(config.expectedActiveSourceCount);
    var point = await hubspotPropagationPoint(config, "before-" + label);
    var checks = {
      endpointsPass: point.endpointPass,
      readonly: point.readonly,
      inventoryPass: point.inventoryPass,
      provenancePass: point.provenancePass,
      activeSourcePresent: !!point.activeSource,
      activeHubspotSourceCountMatchesExpected: point.activeHubspotSourceIds.length === expectedActiveSourceCount,
      hubspotFindingsClear: point.hubspotFindingCount === 0
    };
    var summary = Object.assign({}, point, {
      baselineKey: key,
      expectedActiveSourceCount: expectedActiveSourceCount,
      checks: checks
    });
    summary.readyForProviderChange = Object.keys(checks).every(function (name) { return checks[name] === true; });
    summary.overallPass = summary.readyForProviderChange;
    localStorage.setItem(key, JSON.stringify(summary));
    console.log(summary);
    return summary;
  }

  async function hubspotPropagationAfter(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var label = config.label || "4.8-hubspot-provider-propagation";
    var key = config.baselineKey || storageKey("hubspot-propagation-" + label, campaignId);
    var baseline = JSON.parse(localStorage.getItem(key) || "null");
    var point = await hubspotPropagationPoint(config, "after-" + label);
    var expectedActiveSourceCount = config.expectedActiveSourceCount == null ? 1 : Number(config.expectedActiveSourceCount);
    var expectedRevenueDelta = config.expectedRevenueDelta !== undefined ? config.expectedRevenueDelta : config.expectedHubspotRevenueDelta;
    var beforeSource = baseline && baseline.activeSource || null;
    var afterSource = point.activeSource || null;
    var beforeHubspotRevenue = beforeSource ? optionalMoney(beforeSource.revenueTotal) : null;
    var afterHubspotRevenue = afterSource ? optionalMoney(afterSource.revenueTotal) : null;
    var hubspotRevenueDelta = moneyDelta(afterHubspotRevenue, beforeHubspotRevenue);
    var revenueDelta = baseline ? moneyDelta(point.snapshot.revenueBreakdownTotal, baseline.snapshot && baseline.snapshot.revenueBreakdownTotal) : null;
    var spendDelta = baseline ? moneyDelta(point.snapshot.spendBreakdownTotal, baseline.snapshot && baseline.snapshot.spendBreakdownTotal) : null;
    var recordCountDelta = beforeSource && afterSource ? Number(afterSource.recordCount || 0) - Number(beforeSource.recordCount || 0) : null;
    var providerExpectationProvided = config.expectedHubspotRevenueDelta !== undefined
      || config.expectedHubspotRevenueTotal !== undefined
      || config.expectedHubspotRecordCount !== undefined
      || config.expectedHubspotRecordCountDelta !== undefined;
    var expectedPipelineEnabled = typeof config.expectedPipelineEnabled === "boolean" ? config.expectedPipelineEnabled : null;

    var checks = {
      baselineFound: !!baseline,
      endpointsPass: point.endpointPass,
      readonly: point.readonly,
      inventoryPass: point.inventoryPass,
      provenancePass: point.provenancePass,
      providerExpectationProvided: providerExpectationProvided,
      activeSourcePresent: !!afterSource,
      activeHubspotSourceCountMatchesExpected: point.activeHubspotSourceIds.length === expectedActiveSourceCount,
      sameActiveHubspotSourceIds: baseline ? sameStringList(baseline.activeHubspotSourceIds, point.activeHubspotSourceIds) : false,
      sameRevenueSourceIds: baseline ? sameStringList(baseline.snapshot && baseline.snapshot.revenueSourceIds, point.snapshot.revenueSourceIds) : false,
      sameSpendSourceIds: baseline ? sameStringList(baseline.snapshot && baseline.snapshot.spendSourceIds, point.snapshot.spendSourceIds) : false,
      activeSourceStayedSame: !!(beforeSource && afterSource && String(beforeSource.sourceId) === String(afterSource.sourceId)),
      hubspotFindingsClear: point.hubspotFindingCount === 0,
      revenueDeltaMatchesHubspotDelta: revenueDelta !== null && hubspotRevenueDelta !== null ? closeMoney(revenueDelta, hubspotRevenueDelta) : false,
      spendUnchanged: config.expectSpendUnchanged === false ? undefined : closeMoney(spendDelta, 0)
    };

    if (expectedPipelineEnabled !== null) {
      checks.pipelineExpectationPass = !!(afterSource && afterSource.mapping && afterSource.mapping.pipelineEnabled === expectedPipelineEnabled);
    }
    if (config.expectedHubspotRevenueDelta !== undefined) {
      checks.hubspotRevenueDeltaMatchesExpected = hubspotRevenueDelta !== null && closeMoney(hubspotRevenueDelta, config.expectedHubspotRevenueDelta);
    }
    if (config.expectedHubspotRevenueTotal !== undefined) {
      checks.hubspotRevenueTotalMatchesExpected = afterHubspotRevenue !== null && closeMoney(afterHubspotRevenue, config.expectedHubspotRevenueTotal);
    }
    if (expectedRevenueDelta !== undefined) {
      checks.revenueDeltaMatchesExpected = revenueDelta !== null && closeMoney(revenueDelta, expectedRevenueDelta);
    }
    if (config.expectedHubspotRecordCount !== undefined) {
      checks.hubspotRecordCountMatchesExpected = !!(afterSource && Number(afterSource.recordCount || 0) === Number(config.expectedHubspotRecordCount));
    }
    if (config.expectedHubspotRecordCountDelta !== undefined) {
      checks.hubspotRecordCountDeltaMatchesExpected = recordCountDelta === Number(config.expectedHubspotRecordCountDelta);
    }

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});

    var summary = {
      runnerVersion: VERSION,
      checkedAt: point.checkedAt,
      stage: point.stage,
      campaignId: campaignId,
      propertyId: point.propertyId,
      dateRange: point.dateRange,
      baselineKey: key,
      expected: {
        activeSourceCount: expectedActiveSourceCount,
        pipelineEnabled: expectedPipelineEnabled,
        hubspotRevenueDelta: config.expectedHubspotRevenueDelta,
        hubspotRevenueTotal: config.expectedHubspotRevenueTotal,
        revenueDelta: expectedRevenueDelta,
        hubspotRecordCount: config.expectedHubspotRecordCount,
        hubspotRecordCountDelta: config.expectedHubspotRecordCountDelta
      },
      before: baseline ? {
        activeHubspotSourceIds: baseline.activeHubspotSourceIds || [],
        activeSource: baseline.activeSource || null,
        revenueBreakdownTotal: baseline.snapshot && baseline.snapshot.revenueBreakdownTotal,
        revenueSourceIds: baseline.snapshot && baseline.snapshot.revenueSourceIds || [],
        spendBreakdownTotal: baseline.snapshot && baseline.snapshot.spendBreakdownTotal,
        spendSourceIds: baseline.snapshot && baseline.snapshot.spendSourceIds || []
      } : null,
      after: {
        activeHubspotSourceIds: point.activeHubspotSourceIds,
        activeSource: afterSource,
        revenueBreakdownTotal: point.snapshot.revenueBreakdownTotal,
        revenueSourceIds: point.snapshot.revenueSourceIds,
        spendBreakdownTotal: point.snapshot.spendBreakdownTotal,
        spendSourceIds: point.snapshot.spendSourceIds
      },
      deltas: {
        hubspotRevenue: hubspotRevenueDelta,
        revenueBreakdownTotal: revenueDelta,
        spendBreakdownTotal: spendDelta,
        hubspotRecordCount: recordCountDelta
      },
      endpointStatus: point.endpointStatus,
      checks: effectiveChecks,
      caveats: [
        "This HubSpot propagation helper is read-only and does not trigger scheduler, call HubSpot, or mutate sources/records.",
        "Run it only after a separate controlled HubSpot provider change and existing scheduler/provider propagation path have completed.",
        "A pass does not certify Pipeline Proxy, other campaigns, alternate mappings, Reports, KPI/Benchmark, emails, or future provider mutations."
      ]
    };
    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }
  function normalizeHubspotPipelineValue(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function compactPipelineValueRevenueTotals(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (item) {
      return {
        campaignValue: String(item && item.campaignValue || "").trim(),
        revenue: optionalMoney(item && item.revenue)
      };
    }).filter(function (item) {
      return item.campaignValue && item.revenue !== null;
    });
  }

  function sumPipelineValueRevenueTotals(items) {
    return money((items || []).reduce(function (sum, item) {
      return sum + Number(item && item.revenue || 0);
    }, 0));
  }

  function hubspotPipelineValuesWithinSelectedValues(items, selectedValues) {
    var selected = new Set(arrayValues(selectedValues).map(normalizeHubspotPipelineValue).filter(Boolean));
    if (items.length === 0 || selected.size === 0) return false;
    return items.every(function (item) {
      return selected.has(normalizeHubspotPipelineValue(item && item.campaignValue));
    });
  }

  async function hubspotPipelineProxy(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = config.propertyId ? String(config.propertyId) : null;
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var expectedActiveSourceCount = config.expectedActiveSourceCount == null ? null : Number(config.expectedActiveSourceCount);
    var expectedPipelineSourceCount = config.expectedPipelineSourceCount == null ? 1 : Number(config.expectedPipelineSourceCount);
    var expectedConfirmedRevenueProvided = config.expectedConfirmedRevenueTotal !== undefined;
    var expectedPipelineTotalProvided = config.expectedPipelineTotalToDate !== undefined;
    var expectedConfirmedRevenueTotal = expectedConfirmedRevenueProvided ? optionalMoney(config.expectedConfirmedRevenueTotal) : null;
    var expectedPipelineTotalToDate = expectedPipelineTotalProvided ? optionalMoney(config.expectedPipelineTotalToDate) : null;

    var snapshotResult = await snapshot({
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      includeGa4: config.includeGa4,
      stage: config.stage || "4.9-hubspot-pipeline-proxy-snapshot"
    });
    var damageResult = await fetchJson(
      "hubspotSourceDamageInventory",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"
    );
    var data = damageResult.data || {};
    var provenance = data.hubspotProvenance || {};
    var activeSources = Array.isArray(provenance.activeSources) ? provenance.activeSources : [];
    var activePipelineSources = activeSources.filter(isHubspotPipelineSource);
    var activeSource = compactHubspotSource(selectHubspotPipelineSource(activeSources, config.sourceId));
    var mapping = activeSource && activeSource.mapping || {};
    var selectedValues = Array.isArray(mapping.selectedValues) ? mapping.selectedValues : [];
    var pipelineValueRevenueTotals = compactPipelineValueRevenueTotals(mapping.pipelineValueRevenueTotals);
    var pipelineValueRevenueTotal = sumPipelineValueRevenueTotals(pipelineValueRevenueTotals);
    var persistedPipelineTotal = optionalMoney(mapping.pipelineTotalToDate);
    var effectivePipelineTotal = persistedPipelineTotal !== null ? persistedPipelineTotal : (pipelineValueRevenueTotals.length > 0 ? pipelineValueRevenueTotal : null);
    var positivePipelineTotal = effectivePipelineTotal !== null && effectivePipelineTotal > 0;
    var revenueWithPipeline = expectedConfirmedRevenueProvided && effectivePipelineTotal !== null
      ? money(Number(expectedConfirmedRevenueTotal || 0) + Number(effectivePipelineTotal || 0))
      : null;

    var checks = {
      endpointsPass: snapshotResult.endpointPass && damageResult.pass,
      readonly: data.readonly === true,
      inventoryPass: data.hubspotInventoryPass === true,
      serverProvenancePass: data.hubspotProvenancePass === true,
      selectedSourceProvenancePresent: !!(activeSource && activeSource.mapping && activeSource.platformContext === "ga4" && mapping.platformContext === "ga4"),
      confirmedRevenueExpectationProvided: expectedConfirmedRevenueProvided,
      pipelineTotalExpectationProvided: expectedPipelineTotalProvided,
      activeSourcePresent: !!activeSource,
      activeHubspotSourceCountMatchesExpected: expectedActiveSourceCount === null ? undefined : activeSources.length === expectedActiveSourceCount,
      activePipelineSourceCountMatchesExpected: activePipelineSources.length === expectedPipelineSourceCount,
      hubspotFindingsClear: Number(data.hubspotSummary && data.hubspotSummary.hubspotFindingCount || 0) === 0,
      pipelineEnabled: mapping.pipelineEnabled === true,
      ga4PlatformContext: !!(activeSource && activeSource.platformContext === "ga4" && mapping.platformContext === "ga4"),
      pipelineStagePresent: !!String(mapping.pipelineStageId || "").trim(),
      selectedValuesPresent: selectedValues.length > 0,
      pipelineTotalPresent: effectivePipelineTotal !== null,
      pipelinePositive: positivePipelineTotal,
      pipelineValueTotalsPresent: positivePipelineTotal ? pipelineValueRevenueTotals.length > 0 : true,
      pipelineTotalMatchesValueTotals: pipelineValueRevenueTotals.length > 0 && effectivePipelineTotal !== null ? closeMoney(effectivePipelineTotal, pipelineValueRevenueTotal) : undefined,
      pipelineValuesWithinSelectedValues: pipelineValueRevenueTotals.length > 0 ? hubspotPipelineValuesWithinSelectedValues(pipelineValueRevenueTotals, selectedValues) : undefined,
      revenueBreakdownMatchesExpectedConfirmedTotal: expectedConfirmedRevenueProvided ? closeMoney(snapshotResult.revenue.breakdownTotal, expectedConfirmedRevenueTotal) : undefined,
      pipelineTotalMatchesExpected: expectedPipelineTotalProvided && effectivePipelineTotal !== null ? closeMoney(effectivePipelineTotal, expectedPipelineTotalToDate) : undefined,
      pipelineNotAddedToConfirmedRevenue: expectedConfirmedRevenueProvided && positivePipelineTotal ? !closeMoney(snapshotResult.revenue.breakdownTotal, revenueWithPipeline) : false
    };

    if (config.expectedPipelineStageId !== undefined) {
      checks.pipelineStageIdMatchesExpected = String(mapping.pipelineStageId || "") === String(config.expectedPipelineStageId || "");
    }
    if (config.expectedPipelineStageLabel !== undefined) {
      checks.pipelineStageLabelMatchesExpected = String(mapping.pipelineStageLabel || "") === String(config.expectedPipelineStageLabel || "");
    }
    if (config.expectedSelectedValues !== undefined) {
      checks.selectedValuesMatchExpected = sameStringList(selectedValues, config.expectedSelectedValues);
    }

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});

    var summary = {
      runnerVersion: VERSION,
      checkedAt: data.checkedAt || new Date().toISOString(),
      stage: config.stage || "4.9-hubspot-pipeline-proxy",
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      readonly: data.readonly === true,
      expected: {
        activeSourceCount: expectedActiveSourceCount,
        pipelineSourceCount: expectedPipelineSourceCount,
        confirmedRevenueTotal: config.expectedConfirmedRevenueTotal,
        pipelineTotalToDate: config.expectedPipelineTotalToDate,
        pipelineStageId: config.expectedPipelineStageId,
        pipelineStageLabel: config.expectedPipelineStageLabel,
        selectedValues: config.expectedSelectedValues
      },
      activeSource: activeSource,
      proxy: {
        pipelineEnabled: mapping.pipelineEnabled === true,
        pipelineStageId: mapping.pipelineStageId || null,
        pipelineStageLabel: mapping.pipelineStageLabel || null,
        totalToDate: effectivePipelineTotal,
        persistedTotalToDate: persistedPipelineTotal,
        valueTotalsTotal: pipelineValueRevenueTotal,
        currency: mapping.pipelineCurrency || null,
        lastUpdatedAt: mapping.pipelineLastUpdatedAt || null,
        mode: mapping.pipelineProxyMode || null,
        warning: mapping.pipelineWarning || null,
        selectedValues: selectedValues,
        pipelineValueRevenueTotals: pipelineValueRevenueTotals
      },
      confirmedRevenue: {
        revenueBreakdownTotal: snapshotResult.revenue.breakdownTotal,
        revenueSourceCount: snapshotResult.revenue.sourceCount,
        revenueSourceIds: snapshotResult.revenue.sourceIds || [],
        revenueWithPipelineWouldBe: revenueWithPipeline
      },
      spend: {
        spendBreakdownTotal: snapshotResult.spend.breakdownTotal,
        spendSourceCount: snapshotResult.spend.sourceCount,
        spendSourceIds: snapshotResult.spend.sourceIds || []
      },
      inventoryPass: data.hubspotInventoryPass === true,
      serverProvenancePass: data.hubspotProvenancePass === true,
      selectedSourceProvenancePresent: !!(activeSource && activeSource.mapping),
      activePipelineSourceCount: activePipelineSources.length,
      hubspotSummary: data.hubspotSummary || null,
      hubspotFindings: data.hubspotFindings || {},
      endpointStatus: snapshotResult.endpointStatus.concat([compactEndpointStatus(damageResult)]),
      checks: effectiveChecks,
      caveats: [
        "This HubSpot Pipeline Proxy helper is read-only and does not call HubSpot, trigger scheduler, recompute, create/edit/delete sources, or mutate records.",
        "It selects the active pipeline-enabled HubSpot source by default; pass sourceId if multiple pipeline-enabled HubSpot sources exist.",
        "It validates persisted Pipeline Proxy provenance plus Overview confirmed-revenue separation; local static tests guard the live proxy endpoint scoping.",
        "A pass certifies only the configured campaign/source/proxy packet and does not prove other campaigns, alternate mappings, Reports, KPI/Benchmark, emails, or future provider mutations."
      ]
    };
    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }
  function googleSheetsAmount(sourceRow, breakdownRows, family) {
    var id = sourceId(sourceRow);
    var breakdownRow = breakdownRows.find(function (row) { return sourceId(row) === id; }) || null;
    var breakdownAmount = sourceAmount(breakdownRow, family);
    if (breakdownAmount !== null) return breakdownAmount;
    return sourceAmount(sourceRow, family);
  }

  function googleSheetsSignature(row, family) {
    var spreadsheetId = firstPresent(row, ["spreadsheetId", "googleSpreadsheetId", "sheetId"]);
    var tabName = firstPresent(row, ["tabName", "sheetName", "worksheetName", "selectedTabName", "sheetTitle"]);
    var dateColumn = firstPresent(row, ["dateColumn", "selectedDateColumn"]);
    var campaignColumn = firstPresent(row, ["campaignColumn", "campaignIdentifierColumn", "campaignField"]);
    var campaignValues = sortedValues(firstPresent(row, ["campaignValues", "selectedCampaignValues", "campaignValue"]));
    var amountColumn = family === "spend"
      ? firstPresent(row, ["spendColumn", "costColumn", "amountColumn", "valueColumn"])
      : firstPresent(row, ["revenueColumn", "conversionValueColumn", "amountColumn", "valueColumn"]);

    if (!spreadsheetId && !tabName && !dateColumn && !campaignColumn && !amountColumn && campaignValues.length === 0) {
      return null;
    }

    return [family, spreadsheetId || "", tabName || "", amountColumn || "", dateColumn || "", campaignColumn || "", campaignValues.join(",")]
      .join("|")
      .toLowerCase();
  }

  function duplicateGoogleSheetsGroups(rows, family) {
    var groups = rows.filter(function (row) {
      return sourceActive(row) && sourceType(row).indexOf("google") !== -1;
    }).reduce(function (map, row) {
      var signature = googleSheetsSignature(row, family);
      if (!signature) return map;
      if (!map[signature]) map[signature] = [];
      map[signature].push(row);
      return map;
    }, {});

    return Object.keys(groups).filter(function (signature) {
      return groups[signature].length > 1;
    }).map(function (signature) {
      return {
        family: family,
        count: groups[signature].length,
        sourceIds: groups[signature].map(sourceId).filter(Boolean)
      };
    });
  }

  function normalizeGoogleSheetsVariants(config) {
    var variants = [];
    function add(family, rows) {
      if (!Array.isArray(rows)) return;
      rows.forEach(function (row) {
        variants.push(Object.assign({ family: family }, row || {}));
      });
    }

    if (Array.isArray(config.variants)) {
      config.variants.forEach(function (row) {
        variants.push(Object.assign({}, row || {}));
      });
    }
    add("revenue", config.revenueVariants);
    add("spend", config.spendVariants);
    if (config.expected) {
      add("revenue", config.expected.revenue);
      add("spend", config.expected.spend);
    }
    return variants.map(function (variant, index) {
      return Object.assign({ label: variant.label || "variant-" + String(index + 1) }, variant);
    });
  }

  function findVariantSource(variant, sourceRows) {
    var googleRows = sourceRows.filter(function (row) { return sourceType(row).indexOf("google") !== -1; });
    if (variant.sourceId) {
      return {
        matches: googleRows.filter(function (row) { return sourceId(row) === String(variant.sourceId); }),
        matchMode: "sourceId"
      };
    }
    if (variant.expectedDisplayName) {
      return {
        matches: googleRows.filter(function (row) { return String(sourceDisplayName(row) || "") === String(variant.expectedDisplayName); }),
        matchMode: "displayName"
      };
    }
    return { matches: googleRows, matchMode: "googleSheetsFamily" };
  }

  function validateGoogleSheetsVariant(variant, sourceRows, breakdownRows, includeDetails) {
    var family = variant.family === "revenue" ? "revenue" : "spend";
    var found = findVariantSource(variant, sourceRows);
    var matches = found.matches;
    var source = matches.length === 1 ? matches[0] : null;
    var mapping = mappingConfig(source);
    var tabName = source ? firstPresent(source, ["tabName", "sheetName", "worksheetName", "selectedTabName", "sheetTitle"]) : null;
    var dateColumn = source ? firstPresent(source, ["dateColumn", "selectedDateColumn"]) : null;
    var campaignColumn = source ? firstPresent(source, ["campaignColumn", "campaignIdentifierColumn", "campaignField"]) : null;
    var campaignValues = source ? firstPresent(source, ["campaignValues", "selectedCampaignValues", "campaignValue"]) : null;
    var spreadsheetId = source ? firstPresent(source, ["spreadsheetId", "googleSpreadsheetId", "sheetId"]) : null;
    var rowCount = source ? firstNumber(mapping, ["sheetRowCount", "csvRowCount", "rowCount", "storedRowCount"]) : null;
    var amount = source ? googleSheetsAmount(source, breakdownRows, family) : null;
    var expectedActive = variant.expectedActive === undefined ? true : variant.expectedActive;

    var checks = {
      sourceFound: matches.length > 0,
      sourceUnambiguous: matches.length === 1,
      sourceIsGoogleSheets: source ? sourceType(source).indexOf("google") !== -1 : false,
      activeStateMatchesExpected: source ? sourceActive(source) === expectedActive : false,
      amountMatchesExpected: variant.expectedAmount === undefined || variant.expectedAmount === null ? undefined : closeMoney(amount, variant.expectedAmount),
      displayNameMatchesExpected: source ? compareOptional(sourceDisplayName(source), variant.expectedDisplayName) : undefined,
      spreadsheetIdMatchesExpected: source ? compareOptional(spreadsheetId, variant.expectedSpreadsheetId) : undefined,
      tabNameMatchesExpected: source ? compareOptional(tabName, variant.expectedTabName) : undefined,
      dateColumnMatchesExpected: source ? compareOptional(dateColumn, variant.expectedDateColumn) : undefined,
      campaignColumnMatchesExpected: source ? compareOptional(campaignColumn, variant.expectedCampaignColumn) : undefined,
      campaignValuesIncludeExpected: source ? compareOptionalValues(campaignValues, variant.expectedCampaignValues) : undefined,
      campaignValueCountMatchesExpected: source && variant.expectedCampaignValueCount !== undefined ? arrayValues(campaignValues).length === Number(variant.expectedCampaignValueCount) : undefined,
      rowCountMatchesExpected: source && variant.expectedRowCount !== undefined ? Number(rowCount) === Number(variant.expectedRowCount) : undefined,
      rowCountAtLeastExpected: source && variant.expectedMinimumRowCount !== undefined ? Number(rowCount || 0) >= Number(variant.expectedMinimumRowCount) : undefined
    };

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});

    return {
      label: variant.label,
      family: family,
      matchMode: found.matchMode,
      expected: {
        sourceId: variant.sourceId || null,
        amount: variant.expectedAmount === undefined ? null : variant.expectedAmount,
        displayName: variant.expectedDisplayName || null,
        tabName: variant.expectedTabName || null,
        dateColumn: variant.expectedDateColumn === undefined ? null : variant.expectedDateColumn,
        campaignColumn: variant.expectedCampaignColumn === undefined ? null : variant.expectedCampaignColumn,
        campaignValues: variant.expectedCampaignValues || null,
        campaignValueCount: variant.expectedCampaignValueCount === undefined ? null : variant.expectedCampaignValueCount,
        rowCount: variant.expectedRowCount === undefined ? null : variant.expectedRowCount,
        minimumRowCount: variant.expectedMinimumRowCount === undefined ? null : variant.expectedMinimumRowCount
      },
      matchedSourceCount: matches.length,
      matchedSourceIds: matches.map(sourceId).filter(Boolean),
      actual: source ? {
        sourceId: sourceId(source),
        displayName: sourceDisplayName(source),
        type: sourceType(source),
        active: sourceActive(source),
        amount: amount,
        mapping: googleSheetsMappingSummary(source, includeDetails)
      } : null,
      checks: effectiveChecks,
      overallPass: Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; })
    };
  }

  async function googleSheetsVariantPack(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = config.propertyId ? String(config.propertyId) : null;
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var variants = normalizeGoogleSheetsVariants(config);
    var includeDetails = config.includeMappingDetails === true;

    var base = await snapshot({
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      includeGa4: config.includeGa4 !== false && !!propertyId
    });

    var results = await Promise.all([
      fetchJson("revenueSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources"),
      fetchJson("revenueBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-breakdown"),
      fetchJson("spendSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-sources"),
      fetchJson("spendBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-breakdown")
    ]);
    var byName = endpointMap(results);
    var revenueSources = rowsOf(byName.revenueSources && byName.revenueSources.data);
    var spendSources = rowsOf(byName.spendSources && byName.spendSources.data);
    var revenueBreakdownRows = rowsOf(byName.revenueBreakdown && byName.revenueBreakdown.data);
    var spendBreakdownRows = rowsOf(byName.spendBreakdown && byName.spendBreakdown.data);
    var duplicateRevenueGroups = duplicateGoogleSheetsGroups(revenueSources, "revenue");
    var duplicateSpendGroups = duplicateGoogleSheetsGroups(spendSources, "spend");

    var variantResults = variants.map(function (variant) {
      var family = variant.family === "revenue" ? "revenue" : "spend";
      return validateGoogleSheetsVariant(
        variant,
        family === "revenue" ? revenueSources : spendSources,
        family === "revenue" ? revenueBreakdownRows : spendBreakdownRows,
        includeDetails
      );
    });

    var endpointPass = base.endpointPass && results.every(function (result) { return result.pass; });
    var checks = {
      endpointsPass: endpointPass,
      variantsConfigured: variants.length > 0,
      allVariantsPass: variants.length > 0 && variantResults.every(function (variant) { return variant.overallPass === true; }),
      noDuplicateActiveGoogleSheetsRevenueSignatures: config.allowDuplicateGoogleSheetsSources === true ? undefined : duplicateRevenueGroups.length === 0,
      noDuplicateActiveGoogleSheetsSpendSignatures: config.allowDuplicateGoogleSheetsSources === true ? undefined : duplicateSpendGroups.length === 0,
      revenueTotalMatchesExpected: config.expectedRevenueTotal === undefined ? undefined : closeMoney(base.revenue.breakdownTotal, config.expectedRevenueTotal),
      spendTotalMatchesExpected: config.expectedSpendTotal === undefined ? undefined : closeMoney(base.spend.breakdownTotal, config.expectedSpendTotal)
    };

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});

    var googleSheetsRevenueSources = revenueSources.filter(function (row) { return sourceType(row).indexOf("google") !== -1; });
    var googleSheetsSpendSources = spendSources.filter(function (row) { return sourceType(row).indexOf("google") !== -1; });
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "ga4-overview-google-sheets-variant-pack",
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      endpointStatus: base.endpointStatus.concat(results.map(compactEndpointStatus)),
      totals: {
        revenueBreakdownTotal: base.revenue.breakdownTotal,
        revenueSourceCount: base.revenue.sourceCount,
        googleSheetsRevenueSourceCount: googleSheetsRevenueSources.length,
        spendBreakdownTotal: base.spend.breakdownTotal,
        spendSourceCount: base.spend.sourceCount,
        googleSheetsSpendSourceCount: googleSheetsSpendSources.length
      },
      variantCount: variants.length,
      variants: variantResults,
      duplicateActiveGoogleSheetsGroups: duplicateRevenueGroups.concat(duplicateSpendGroups),
      caveats: [
        "This pack validates already-created Google Sheets sources; it does not import, edit, refresh, delete, or inspect rendered UI pixels.",
        "Mapping checks use persisted source metadata returned by the deployed source endpoints, not a live Google Sheets cell-by-cell audit.",
        "A passing variant pack closes only the configured fixture variants and is not proof for unsupported or unlisted Google Sheets mapping shapes."
      ],
      checks: effectiveChecks
    };

    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }

  function help() {
    var examples = [
      "await import('/ga4-overview-validation-runner.js?v=2026-07-04.5')",
      "await GA4OverviewValidation.overviewPack({ campaignId, propertyId })",
      "await GA4OverviewValidation.reportPack({ campaignId, reportId, createSnapshot: true })",
      "await GA4OverviewValidation.sourceDamageInventory({ campaignId })",
      "await GA4OverviewValidation.hubspotInventory({ campaignId })",
      "await GA4OverviewValidation.hubspotProvenance({ campaignId, expectedPipelineEnabled: false })",
      "await GA4OverviewValidation.hubspotPipelineProxy({ campaignId, propertyId, expectedConfirmedRevenueTotal: 7600, expectedPipelineTotalToDate: 1234.56, expectedSelectedValues: ['CAMPAIGN_VALUE'] })",
      "await GA4OverviewValidation.hubspotPropagationBefore({ campaignId, propertyId, label: '4.8-hubspot-provider-propagation' })",
      "await GA4OverviewValidation.hubspotPropagationAfter({ campaignId, propertyId, label: '4.8-hubspot-provider-propagation', expectedHubspotRevenueDelta: 1000 })",
      "await GA4OverviewValidation.googleSheetsVariantPack({ campaignId, propertyId, variants: [{ family: 'spend', sourceId, expectedAmount: 123.45, expectedDateColumn: true }] })",
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
    sourceDamageInventory: sourceDamageInventory,
    hubspotInventory: hubspotInventory,
    hubspotProvenance: hubspotProvenance,
    hubspotPipelineProxy: hubspotPipelineProxy,
    hubspotPropagationBefore: hubspotPropagationBefore,
    hubspotPropagationAfter: hubspotPropagationAfter,
    googleSheetsVariantPack: googleSheetsVariantPack,
    help: help
  };

  console.log("GA4OverviewValidation loaded", { version: VERSION });
})();

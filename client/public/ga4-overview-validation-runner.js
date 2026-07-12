(function () {
  "use strict";

  var VERSION = "2026-07-12.6";
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

  function formattedNumberOrNull(value) {
    var parsed = numberOrNull(value);
    if (parsed !== null) return parsed;
    if (typeof value !== "string") return null;
    var cleaned = value.replace(/[$,%x\s]/gi, "").replace(/,/g, "").trim();
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    var n = Number(cleaned);
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

  function buildCsvRevenueSources(sourceRows, breakdownRows) {
    return sourceRows.filter(function (row) {
      return sourceActive(row) && sourceType(row) === "csv";
    }).map(function (row) {
      var id = String(sourceId(row) || "");
      var breakdown = breakdownRows.find(function (item) { return String(sourceId(item) || "") === id; }) || null;
      return {
        sourceId: id,
        displayName: sourceDisplayName(row),
        amount: breakdown ? sourceAmount(breakdown, "revenue") : sourceAmount(row, "revenue")
      };
    });
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
        breakdownTotal: totals.revenueBreakdownTotal,
        csvSources: buildCsvRevenueSources(revenueSources, revenueBreakdownRows)
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
      if (config.requireRevenueEndpointParity === true) {
        checks.beforeRevenueToDateMatchesBreakdown = closeMoney(baseline.revenue.toDate, baseline.revenue.breakdownTotal);
        checks.afterRevenueToDateMatchesBreakdown = closeMoney(result.revenue.toDate, result.revenue.breakdownTotal);
      }
    }

    if (config.targetSourceId) {
      if (config.targetFamily === "revenue") {
        checks.targetRevenueSourceStateBeforeMatches = config.targetShouldExistBefore === undefined || !baseline
          ? undefined
          : baseline.revenue.targetPresent === config.targetShouldExistBefore;
        checks.targetRevenueSourceStateMatches = config.targetShouldExist === undefined ? undefined : result.revenue.targetPresent === config.targetShouldExist;
        checks.targetRevenueBreakdownStateMatches = config.targetShouldExist === undefined ? undefined : result.revenue.targetInBreakdown === config.targetShouldExist;
        checks.targetRevenueAmountMatchesExpected = config.expectedTargetAmount === undefined
          ? undefined
          : closeMoney(result.revenue.targetAmount, config.expectedTargetAmount) && closeMoney(result.revenue.targetBreakdownAmount, config.expectedTargetAmount);
        checks.targetRevenueAmountDeltaMatchesExpected = config.expectedTargetAmountDelta === undefined || !baseline
          ? undefined
          : compareNumberDelta(baseline.revenue.targetAmount, result.revenue.targetAmount, config.expectedTargetAmountDelta);
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
        targetShouldExistBefore: config.targetShouldExistBefore,
        targetShouldExist: config.targetShouldExist,
        targetAmount: config.expectedTargetAmount,
        targetAmountDelta: config.expectedTargetAmountDelta,
        requireRevenueEndpointParity: config.requireRevenueEndpointParity === true
      },
      before: baseline ? {
        revenueBreakdownTotal: baseline.revenue.breakdownTotal,
        revenueSourceCount: baseline.revenue.sourceCount,
        targetRevenueAmount: config.targetSourceId ? baseline.revenue.targetAmount : undefined,
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
        targetRevenueAmount: config.targetSourceId ? result.revenue.targetAmount : undefined,
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
      csvInventoryPass: data.csvInventoryPass === true,
      csvSummary: data.csvSummary || null,
      csvFindings: data.csvFindings || null,
      csvCleanupAssessment: data.csvCleanupAssessment || null,
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
      hubspotFindings: Object.assign({}, hubspotFindings, {
        activeHubspotSourcesWithZeroRecords: hubspotFindings.activeHubspotSourcesWithZeroRecords || [],
        orphanHubspotRevenueRecordGroups: hubspotFindings.orphanHubspotRevenueRecordGroups || [],
        duplicateActiveHubspotSourceGroups: hubspotFindings.duplicateActiveHubspotSourceGroups || [],
        hubspotGa4ContextMismatchSources: hubspotFindings.hubspotGa4ContextMismatchSources || [],
        hubspotPipelineProxyScopeMismatches: hubspotFindings.hubspotPipelineProxyScopeMismatches || []
      }),
      cleanupAssessment: data.hubspotCleanupAssessment || null,
      hubspotCertificationImpact: data.hubspotCertificationImpact || null,
      generalInventoryPass: data.overallPass === true,
      generalSummary: data.summary || null,
      caveats: [
        "This HubSpot inventory is read-only and must be run before and after deployed provider lifecycle validation.",
        "It does not create, refresh, delete, clean, recompute, or certify provider behavior."
      ].concat(data.caveats || [])
    };
    summary.overallPass = result.pass && data.success === true && data.readonly === true && data.hubspotInventoryPass === true
      && data.hubspotCleanupAssessment && data.hubspotCleanupAssessment.automaticCleanupAllowed === false;
    console.log(summary);
    return summary;
  }

  async function csvRevenueInventory(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var result = await fetchJson(
      "csvRevenueInventory",
      "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"
    );
    var data = result.data || {};
    var findings = data.csvFindings || {};
    var expectedInactiveIds = sortedValues(config.expectedInactiveSourceIds || []);
    var inactiveRows = Array.isArray(findings.inactiveCsvSourceRecordGroups) ? findings.inactiveCsvSourceRecordGroups : [];
    var inactiveIds = inactiveRows.map(function (row) { return String(row && row.sourceId || ""); }).filter(Boolean).sort();
    var activeFindingKeys = [
      "activeSourcesWithZeroRecords",
      "orphanCsvRecordGroups",
      "crossCampaignCsvRecordGroups",
      "wrongSourceTypeRecordGroups",
      "incompleteStoredMappingSources",
      "storedTotalMismatchSources",
      "datedRevenueLossSources",
      "duplicateRecordGroups",
      "duplicateActiveCsvSourceGroups"
    ];
    var activeFindingsClear = activeFindingKeys.every(function (key) {
      return !Array.isArray(findings[key]) || findings[key].length === 0;
    });
    var checks = {
      endpointPasses: result.pass && data.success === true,
      inventoryIsReadOnly: data.readonly === true,
      activeAndReconciliationFindingsClear: activeFindingsClear,
      inactiveFindingsMatchExpectedBoundary: expectedInactiveIds.length > 0
        ? JSON.stringify(inactiveIds) === JSON.stringify(expectedInactiveIds)
        : inactiveIds.length === 0,
      automaticCleanupBlocked: data.csvCleanupAssessment && data.csvCleanupAssessment.automaticCleanupAllowed === false
    };
    var summary = {
      runnerVersion: VERSION,
      checkedAt: data.checkedAt || new Date().toISOString(),
      stage: config.stage || "csv-revenue-read-only-inventory",
      campaignId: campaignId,
      endpoint: compactEndpointStatus(result),
      csvSummary: data.csvSummary || null,
      inactiveSourceIds: inactiveIds,
      inactiveRecordCount: inactiveRows.reduce(function (sum, row) { return sum + Number(row && row.recordCount || 0); }, 0),
      activeFindingKeys: activeFindingKeys,
      cleanupAssessment: data.csvCleanupAssessment || null,
      caveats: [
        "This function is GET-only and does not clean, edit, delete, refresh, or recompute source data.",
        "Known inactive-source rows must be supplied explicitly; unexpected active or reconciliation findings fail the packet.",
        "A pass applies only to this campaign at checkedAt and does not replace the UI add/edit/delete lifecycle packet."
      ],
      checks: checks
    };
    summary.overallPass = Object.keys(checks).every(function (name) { return checks[name] === true; });
    console.log(summary);
    return summary;
  }

  async function csvRevenueBefore(label, config) {
    return before(label, Object.assign({ targetFamily: "revenue" }, config || {}));
  }

  async function csvRevenueAfter(label, config) {
    return after(label, Object.assign({
      targetFamily: "revenue",
      expectSpendUnchanged: true,
      requireRevenueEndpointParity: true
    }, config || {}));
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
    var expectedActiveSourceCount = config.allowAnyActiveSourceCount === true
      ? null
      : (config.expectedActiveSourceCount == null ? 1 : Number(config.expectedActiveSourceCount));
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

  function hubspotPipelineTotalFromMapping(mapping) {
    mapping = mapping || {};
    var pipelineValueRevenueTotals = compactPipelineValueRevenueTotals(mapping.pipelineValueRevenueTotals);
    var pipelineValueRevenueTotal = sumPipelineValueRevenueTotals(pipelineValueRevenueTotals);
    var persistedPipelineTotal = optionalMoney(mapping.pipelineTotalToDate);
    var effectivePipelineTotal = persistedPipelineTotal !== null
      ? persistedPipelineTotal
      : (pipelineValueRevenueTotals.length > 0 ? pipelineValueRevenueTotal : (mapping.pipelineEnabled === true ? 0 : null));
    return {
      totalToDate: effectivePipelineTotal,
      persistedTotalToDate: persistedPipelineTotal,
      valueTotalsTotal: pipelineValueRevenueTotal,
      pipelineValueRevenueTotals: pipelineValueRevenueTotals
    };
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

  async function hubspotProxyTransitionPoint(config, stage) {
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
    var activePipelineSources = activeSources.filter(isHubspotPipelineSource);
    var activeSource = compactHubspotSource(selectHubspotPipelineSource(activeSources, config.sourceId));
    var mapping = activeSource && activeSource.mapping || {};
    var selectedValues = Array.isArray(mapping.selectedValues) ? mapping.selectedValues : [];
    var pipelineTotals = hubspotPipelineTotalFromMapping(mapping);
    var endpointStatus = snapshotResult.endpointStatus.concat([compactEndpointStatus(damageResult)]);

    return {
      runnerVersion: VERSION,
      checkedAt: data.checkedAt || new Date().toISOString(),
      stage: stage,
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      endpointPass: endpointStatus.every(function (status) { return status.pass === true; }),
      endpointStatus: endpointStatus,
      readonly: data.readonly === true,
      inventoryPass: data.hubspotInventoryPass === true,
      serverProvenancePass: data.hubspotProvenancePass === true,
      selectedSourceProvenancePresent: !!(activeSource && activeSource.mapping && activeSource.platformContext === "ga4" && mapping.platformContext === "ga4"),
      activePipelineSourceIds: activePipelineSources.map(function (source) {
        return String(source && (source.sourceId || source.id || ""));
      }).filter(Boolean).sort(),
      activePipelineSourceCount: activePipelineSources.length,
      activeSource: activeSource,
      proxy: {
        pipelineEnabled: mapping.pipelineEnabled === true,
        pipelineStageId: mapping.pipelineStageId || null,
        pipelineStageLabel: mapping.pipelineStageLabel || null,
        totalToDate: pipelineTotals.totalToDate,
        persistedTotalToDate: pipelineTotals.persistedTotalToDate,
        valueTotalsTotal: pipelineTotals.valueTotalsTotal,
        selectedValues: selectedValues,
        pipelineValueRevenueTotals: pipelineTotals.pipelineValueRevenueTotals
      },
      confirmedRevenue: {
        revenueBreakdownTotal: snapshotResult.revenue.breakdownTotal,
        revenueSourceCount: snapshotResult.revenue.sourceCount,
        revenueSourceIds: snapshotResult.revenue.sourceIds || []
      },
      spend: {
        spendBreakdownTotal: snapshotResult.spend.breakdownTotal,
        spendSourceCount: snapshotResult.spend.sourceCount,
        spendSourceIds: snapshotResult.spend.sourceIds || []
      },
      hubspotSummary: data.hubspotSummary || null,
      hubspotFindings: data.hubspotFindings || {},
      hubspotFindingCount: Number(data.hubspotSummary && data.hubspotSummary.hubspotFindingCount || 0),
      caveats: [
        "This HubSpot proxy-to-confirmed transition helper is read-only and does not trigger scheduler, call HubSpot, post save-mappings, create/edit/delete sources, recompute, send reports, or mutate records.",
        "Run before, then move exactly one controlled HubSpot deal from the configured proxy stage into the closed revenue state outside this runner, let the existing scheduler/provider path complete, and run after.",
        "A pass proves only the configured campaign/source/stage transition packet; Campaign Breakdown, Reports, KPI/Benchmark, emails, other campaigns, alternate mappings, and future provider mutations remain separate evidence."
      ]
    };
  }

  async function hubspotProxyTransitionBefore(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var label = config.label || "4.10-hubspot-proxy-to-confirmed-transition";
    var key = storageKey("hubspot-proxy-transition-" + label, campaignId);
    var expectedPipelineSourceCount = config.expectedPipelineSourceCount == null ? 1 : Number(config.expectedPipelineSourceCount);
    var point = await hubspotProxyTransitionPoint(config, "before-" + label);
    var checks = {
      endpointsPass: point.endpointPass,
      readonly: point.readonly,
      inventoryPass: point.inventoryPass,
      selectedSourceProvenancePresent: point.selectedSourceProvenancePresent,
      activeSourcePresent: !!point.activeSource,
      activePipelineSourceCountMatchesExpected: point.activePipelineSourceCount === expectedPipelineSourceCount,
      hubspotFindingsClear: point.hubspotFindingCount === 0,
      pipelineEnabled: point.proxy.pipelineEnabled === true,
      ga4PlatformContext: !!(point.activeSource && point.activeSource.platformContext === "ga4" && point.activeSource.mapping && point.activeSource.mapping.platformContext === "ga4"),
      pipelineStagePresent: !!String(point.proxy.pipelineStageId || "").trim(),
      selectedValuesPresent: point.proxy.selectedValues.length > 0,
      proxyTotalPresent: point.proxy.totalToDate !== null,
      proxyPositiveBefore: config.expectProxyPositiveBefore === false ? undefined : point.proxy.totalToDate !== null && point.proxy.totalToDate > 0
    };

    if (config.expectedPipelineTotalBefore !== undefined) {
      checks.pipelineTotalBeforeMatchesExpected = point.proxy.totalToDate !== null && closeMoney(point.proxy.totalToDate, config.expectedPipelineTotalBefore);
    }
    if (config.expectedConfirmedRevenueBefore !== undefined) {
      checks.confirmedRevenueBeforeMatchesExpected = closeMoney(point.confirmedRevenue.revenueBreakdownTotal, config.expectedConfirmedRevenueBefore);
    }
    if (config.expectedPipelineStageLabel !== undefined) {
      checks.pipelineStageLabelMatchesExpected = String(point.proxy.pipelineStageLabel || "") === String(config.expectedPipelineStageLabel || "");
    }
    if (config.expectedSelectedValues !== undefined) {
      checks.selectedValuesMatchExpected = sameStringList(point.proxy.selectedValues, config.expectedSelectedValues);
    }

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var summary = Object.assign({}, point, {
      baselineKey: key,
      expected: {
        pipelineSourceCount: expectedPipelineSourceCount,
        pipelineTotalBefore: config.expectedPipelineTotalBefore,
        confirmedRevenueBefore: config.expectedConfirmedRevenueBefore,
        pipelineStageLabel: config.expectedPipelineStageLabel,
        selectedValues: config.expectedSelectedValues
      },
      checks: effectiveChecks
    });
    summary.readyForProviderStageMove = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    summary.overallPass = summary.readyForProviderStageMove;
    localStorage.setItem(key, JSON.stringify(summary));
    console.log(summary);
    return summary;
  }

  async function hubspotProxyTransitionAfter(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var label = config.label || "4.10-hubspot-proxy-to-confirmed-transition";
    var key = config.baselineKey || storageKey("hubspot-proxy-transition-" + label, campaignId);
    var baseline = JSON.parse(localStorage.getItem(key) || "null");
    var point = await hubspotProxyTransitionPoint(config, "after-" + label);
    var expectedPipelineSourceCount = config.expectedPipelineSourceCount == null ? 1 : Number(config.expectedPipelineSourceCount);
    var beforeSource = baseline && baseline.activeSource || null;
    var afterSource = point.activeSource || null;
    var beforeProxyTotal = baseline && baseline.proxy ? baseline.proxy.totalToDate : null;
    var afterProxyTotal = point.proxy.totalToDate;
    var beforeConfirmedRevenue = baseline && baseline.confirmedRevenue ? baseline.confirmedRevenue.revenueBreakdownTotal : null;
    var afterConfirmedRevenue = point.confirmedRevenue.revenueBreakdownTotal;
    var beforeCombined = beforeProxyTotal !== null && beforeConfirmedRevenue !== null ? money(Number(beforeProxyTotal) + Number(beforeConfirmedRevenue)) : null;
    var afterCombined = afterProxyTotal !== null && afterConfirmedRevenue !== null ? money(Number(afterProxyTotal) + Number(afterConfirmedRevenue)) : null;
    var proxyDelta = moneyDelta(afterProxyTotal, beforeProxyTotal);
    var confirmedRevenueDelta = moneyDelta(afterConfirmedRevenue, beforeConfirmedRevenue);
    var combinedDelta = moneyDelta(afterCombined, beforeCombined);
    var spendDelta = baseline ? moneyDelta(point.spend.spendBreakdownTotal, baseline.spend && baseline.spend.spendBreakdownTotal) : null;
    var sourceRevenueDelta = beforeSource && afterSource ? moneyDelta(afterSource.revenueTotal, beforeSource.revenueTotal) : null;
    var expectedProxyDelta = config.expectedProxyDelta !== undefined ? config.expectedProxyDelta : config.expectedPipelineDelta;
    var expectedConfirmedRevenueDelta = config.expectedConfirmedRevenueDelta !== undefined ? config.expectedConfirmedRevenueDelta : config.expectedRevenueDelta;
    var expectedCombinedDelta = config.expectedCombinedRevenueAndProxyDelta !== undefined
      ? config.expectedCombinedRevenueAndProxyDelta
      : (expectedProxyDelta !== undefined && expectedConfirmedRevenueDelta !== undefined ? money(Number(expectedProxyDelta || 0) + Number(expectedConfirmedRevenueDelta || 0)) : undefined);
    var transitionExpectationProvided = expectedProxyDelta !== undefined && expectedConfirmedRevenueDelta !== undefined;

    var checks = {
      baselineFound: !!baseline,
      endpointsPass: point.endpointPass,
      readonly: point.readonly,
      inventoryPass: point.inventoryPass,
      selectedSourceProvenancePresent: point.selectedSourceProvenancePresent,
      transitionExpectationProvided: transitionExpectationProvided,
      activeSourcePresent: !!afterSource,
      activePipelineSourceCountMatchesExpected: point.activePipelineSourceCount === expectedPipelineSourceCount,
      activePipelineSourceStayedSame: !!(beforeSource && afterSource && String(beforeSource.sourceId) === String(afterSource.sourceId)),
      sameRevenueSourceIds: baseline ? sameStringList(baseline.confirmedRevenue && baseline.confirmedRevenue.revenueSourceIds, point.confirmedRevenue.revenueSourceIds) : false,
      sameSpendSourceIds: baseline ? sameStringList(baseline.spend && baseline.spend.spendSourceIds, point.spend.spendSourceIds) : false,
      hubspotFindingsClear: point.hubspotFindingCount === 0,
      proxyDecreased: proxyDelta !== null && proxyDelta < 0,
      confirmedRevenueIncreased: confirmedRevenueDelta !== null && confirmedRevenueDelta > 0,
      spendUnchanged: config.expectSpendUnchanged === false ? undefined : closeMoney(spendDelta, 0),
      activeSourceRevenueDeltaMatchesConfirmedDelta: sourceRevenueDelta !== null && confirmedRevenueDelta !== null ? closeMoney(sourceRevenueDelta, confirmedRevenueDelta) : false
    };

    if (expectedProxyDelta !== undefined) {
      checks.proxyDeltaMatchesExpected = proxyDelta !== null && closeMoney(proxyDelta, expectedProxyDelta);
    }
    if (expectedConfirmedRevenueDelta !== undefined) {
      checks.confirmedRevenueDeltaMatchesExpected = confirmedRevenueDelta !== null && closeMoney(confirmedRevenueDelta, expectedConfirmedRevenueDelta);
    }
    if (expectedCombinedDelta !== undefined) {
      checks.combinedRevenueAndProxyDeltaMatchesExpected = combinedDelta !== null && closeMoney(combinedDelta, expectedCombinedDelta);
    }
    if (config.expectedPipelineTotalAfter !== undefined) {
      checks.pipelineTotalAfterMatchesExpected = afterProxyTotal !== null && closeMoney(afterProxyTotal, config.expectedPipelineTotalAfter);
    }
    if (config.expectedConfirmedRevenueAfter !== undefined) {
      checks.confirmedRevenueAfterMatchesExpected = closeMoney(afterConfirmedRevenue, config.expectedConfirmedRevenueAfter);
    }
    if (config.expectedPipelineStageLabel !== undefined) {
      checks.pipelineStageLabelMatchesExpected = String(point.proxy.pipelineStageLabel || "") === String(config.expectedPipelineStageLabel || "");
    }
    if (config.expectedSelectedValues !== undefined) {
      checks.selectedValuesMatchExpected = sameStringList(point.proxy.selectedValues, config.expectedSelectedValues);
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
        pipelineSourceCount: expectedPipelineSourceCount,
        proxyDelta: expectedProxyDelta,
        confirmedRevenueDelta: expectedConfirmedRevenueDelta,
        combinedRevenueAndProxyDelta: expectedCombinedDelta,
        pipelineTotalAfter: config.expectedPipelineTotalAfter,
        confirmedRevenueAfter: config.expectedConfirmedRevenueAfter,
        pipelineStageLabel: config.expectedPipelineStageLabel,
        selectedValues: config.expectedSelectedValues
      },
      before: baseline ? {
        activePipelineSourceIds: baseline.activePipelineSourceIds || [],
        activeSource: baseline.activeSource || null,
        proxyTotalToDate: beforeProxyTotal,
        confirmedRevenueBreakdownTotal: beforeConfirmedRevenue,
        revenueSourceIds: baseline.confirmedRevenue && baseline.confirmedRevenue.revenueSourceIds || [],
        spendBreakdownTotal: baseline.spend && baseline.spend.spendBreakdownTotal,
        spendSourceIds: baseline.spend && baseline.spend.spendSourceIds || []
      } : null,
      after: {
        activePipelineSourceIds: point.activePipelineSourceIds,
        activeSource: afterSource,
        proxyTotalToDate: afterProxyTotal,
        confirmedRevenueBreakdownTotal: afterConfirmedRevenue,
        revenueSourceIds: point.confirmedRevenue.revenueSourceIds,
        spendBreakdownTotal: point.spend.spendBreakdownTotal,
        spendSourceIds: point.spend.spendSourceIds
      },
      deltas: {
        proxyTotalToDate: proxyDelta,
        confirmedRevenueBreakdownTotal: confirmedRevenueDelta,
        combinedRevenueAndProxy: combinedDelta,
        activeSourceRevenue: sourceRevenueDelta,
        spendBreakdownTotal: spendDelta
      },
      endpointStatus: point.endpointStatus,
      checks: effectiveChecks,
      inventoryPass: point.inventoryPass,
      serverProvenancePass: point.serverProvenancePass,
      hubspotSummary: point.hubspotSummary,
      hubspotFindings: point.hubspotFindings,
      caveats: point.caveats
    };
    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }

  function parseStoredGa4CampaignFilterForRunner(raw) {
    if (raw === null || raw === undefined) return [];
    var value = String(raw || "").trim();
    if (!value) return [];
    if (value.charAt(0) === "[" && value.charAt(value.length - 1) === "]") {
      try {
        var parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map(function (item) { return String(item || "").trim(); }).filter(Boolean);
        }
      } catch (_) {}
    }
    return [value];
  }

  function normalizeCampaignBreakdownKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function revenueDisplaySourcesForCampaignBreakdown(revenueSourcesData, revenueBreakdownData) {
    var defs = rowsOf(revenueSourcesData);
    var breakdownSources = rowsOf(revenueBreakdownData);
    var getDefinitionRevenue = function (source) {
      var cfg = mappingConfig(source);
      return Number(source && (source.lastTotalRevenue || source.lastRevenue) || cfg.lastTotalRevenue || 0);
    };
    var defsMap = new Map();
    var defsByType = new Map();
    var defsWithCampaignTotalsByType = new Map();

    defs.forEach(function (source) {
      if (!source) return;
      defsMap.set(String(source.id || source.sourceId || ""), source);
      var type = sourceType(source);
      if (!type) return;
      defsByType.set(type, defsByType.has(type) ? null : source);
      var cfg = mappingConfig(source);
      if (Array.isArray(cfg.campaignValueRevenueTotals) && cfg.campaignValueRevenueTotals.length > 0) {
        defsWithCampaignTotalsByType.set(type, source);
      }
    });

    if (breakdownSources.length > 0) {
      var rows = breakdownSources.map(function (source) {
        var type = sourceType(source);
        var byTypeWithTotals = defsWithCampaignTotalsByType.get(type);
        var byType = defsByType.get(type);
        var sourceDefinition = defsMap.get(String(sourceId(source) || "")) || byTypeWithTotals || byType || null;
        return Object.assign({}, source, {
          sourceId: sourceId(source) || source.sourceId || source.id,
          sourceType: source.sourceType || source.type,
          displayName: source.displayName || source.name,
          mappingConfig: sourceDefinition && sourceDefinition.mappingConfig || source.mappingConfig || null
        });
      });
      var shownIds = new Set(rows.map(function (source) { return String(source.sourceId || source.id || ""); }));
      defs.filter(function (source) { return sourceActive(source); }).forEach(function (source) {
        var id = String(source.id || source.sourceId || "");
        if (shownIds.has(id)) return;
        rows.push({
          sourceId: id,
          sourceType: source.sourceType || source.type,
          displayName: source.displayName || source.name,
          revenue: getDefinitionRevenue(source),
          mappingConfig: source.mappingConfig || null
        });
      });
      return rows;
    }

    return defs.filter(function (source) { return sourceActive(source); }).map(function (source) {
      return {
        sourceId: source.id || source.sourceId,
        sourceType: source.sourceType || source.type,
        displayName: source.displayName || source.name,
        revenue: getDefinitionRevenue(source),
        mappingConfig: source.mappingConfig || null
      };
    });
  }

  function campaignMappingTarget(mapping) {
    return String(mapping && (mapping.linkedinCampaignName || mapping.linkedinCampaignUrn) || "").trim();
  }

  function buildCampaignBreakdownRows(ga4BreakdownData, revenueSourcesData, revenueBreakdownData, selectedGa4CampaignValues) {
    var importedNames = new Set(arrayValues(selectedGa4CampaignValues).map(normalizeCampaignBreakdownKey).filter(Boolean));
    var byName = new Map();
    rowsOf(ga4BreakdownData).forEach(function (row) {
      var name = String(row && (row.campaign || row.name) || "(not set)").trim();
      var existing = byName.get(name) || { name: name, sessions: 0, users: 0, conversions: 0, nativeRevenue: 0 };
      existing.sessions += Number(row && row.sessions || 0);
      existing.users += Number(row && row.users || 0);
      existing.conversions += Number(row && row.conversions || 0);
      existing.nativeRevenue += Number(row && row.revenue || 0);
      byName.set(name, existing);
    });

    var filteredRows = Array.from(byName.values()).filter(function (row) {
      return importedNames.size === 0 || importedNames.has(normalizeCampaignBreakdownKey(row.name));
    });
    var rowByKey = new Map();
    filteredRows.forEach(function (row) {
      var key = normalizeCampaignBreakdownKey(row.name);
      if (key) rowByKey.set(key, row);
    });

    var displaySources = revenueDisplaySourcesForCampaignBreakdown(revenueSourcesData, revenueBreakdownData);
    displaySources.forEach(function (source) {
      var cfg = mappingConfig(source);
      var totals = Array.isArray(cfg.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
      var mappings = Array.isArray(cfg.campaignMappings) ? cfg.campaignMappings : [];
      var mappedCampaignByValue = new Map();
      mappings.forEach(function (mapping) {
        var valueKey = normalizeCampaignBreakdownKey(mapping && mapping.crmValue);
        var mappedName = campaignMappingTarget(mapping);
        if (valueKey && mappedName) mappedCampaignByValue.set(valueKey, mappedName);
      });
      totals.forEach(function (item) {
        if (!(Number(item && item.revenue || 0) > 0)) return;
        var valueKey = normalizeCampaignBreakdownKey(item && item.campaignValue);
        var name = String(mappedCampaignByValue.get(valueKey) || item && item.campaignValue || "").trim();
        var key = normalizeCampaignBreakdownKey(name);
        if (!key || rowByKey.has(key)) return;
        if (importedNames.size > 0 && !importedNames.has(key)) return;
        var row = { name: name, sessions: 0, users: 0, conversions: 0, nativeRevenue: 0 };
        filteredRows.push(row);
        rowByKey.set(key, row);
      });
    });

    var externalByRowName = new Map();
    var hubspotByRowName = new Map();
    displaySources.forEach(function (source) {
      var cfg = mappingConfig(source);
      var totals = Array.isArray(cfg.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
      var mappings = Array.isArray(cfg.campaignMappings) ? cfg.campaignMappings : [];
      var mappedCampaignByValue = new Map();
      mappings.forEach(function (mapping) {
        var valueKey = normalizeCampaignBreakdownKey(mapping && mapping.crmValue);
        var mappedName = campaignMappingTarget(mapping);
        if (valueKey && mappedName) mappedCampaignByValue.set(valueKey, mappedName);
      });
      totals.forEach(function (item) {
        var valueKey = normalizeCampaignBreakdownKey(item && item.campaignValue);
        var key = normalizeCampaignBreakdownKey(mappedCampaignByValue.get(valueKey) || item && item.campaignValue);
        var row = rowByKey.get(key);
        var revenue = Number(item && item.revenue || 0);
        if (!row || !(revenue > 0)) return;
        externalByRowName.set(row.name, Number(externalByRowName.get(row.name) || 0) + revenue);
        if (sourceType(source).indexOf("hubspot") !== -1) {
          hubspotByRowName.set(row.name, Number(hubspotByRowName.get(row.name) || 0) + revenue);
        }
      });
    });

    return filteredRows.map(function (row) {
      var nativeRevenue = money(row.nativeRevenue || 0) || 0;
      var externalRevenue = money(externalByRowName.get(row.name) || 0) || 0;
      var hubspotRevenue = money(hubspotByRowName.get(row.name) || 0) || 0;
      var displayedRevenue = money(nativeRevenue + externalRevenue) || 0;
      return {
        name: row.name,
        key: normalizeCampaignBreakdownKey(row.name),
        sessions: Number(row.sessions || 0),
        users: Number(row.users || 0),
        conversions: Number(row.conversions || 0),
        nativeRevenue: nativeRevenue,
        externalRevenue: externalRevenue,
        hubspotRevenue: hubspotRevenue,
        displayedRevenue: displayedRevenue,
        conversionRate: Number(row.sessions || 0) > 0 ? (Number(row.conversions || 0) / Number(row.sessions || 0)) * 100 : 0,
        revenuePerSession: Number(row.sessions || 0) > 0 ? displayedRevenue / Number(row.sessions || 0) : 0
      };
    }).sort(function (a, b) { return Number(b.sessions || 0) - Number(a.sessions || 0); });
  }

  function findCampaignBreakdownRow(rows, campaignName) {
    var key = normalizeCampaignBreakdownKey(campaignName);
    if (!key) return null;
    return rows.find(function (row) { return row.key === key; }) || null;
  }

  function compactCampaignBreakdownRow(row) {
    if (!row) return null;
    return {
      name: row.name,
      key: row.key,
      sessions: row.sessions,
      users: row.users,
      conversions: row.conversions,
      nativeRevenue: row.nativeRevenue,
      externalRevenue: row.externalRevenue,
      hubspotRevenue: row.hubspotRevenue,
      displayedRevenue: row.displayedRevenue
    };
  }

  function namedCampaignBreakdownRows(rows, names) {
    return arrayValues(names).map(function (name) {
      var row = findCampaignBreakdownRow(rows, name);
      return {
        expectedName: name,
        row: compactCampaignBreakdownRow(row)
      };
    });
  }

  async function hubspotCampaignBreakdownPoint(config, stage) {
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = requireValue(config.propertyId, "propertyId");
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var targetCampaignName = requireValue(config.targetCampaignName || config.expectedMappedCampaignName || config.mappedCampaignName, "targetCampaignName");
    var unchangedCampaignNames = arrayValues(config.unchangedCampaignNames || config.expectedUnchangedCampaignNames || config.unaffectedCampaignNames);

    var results = await Promise.all([
      fetchJson("campaign", "/api/campaigns/" + encodeURIComponent(campaignId)),
      fetchJson("ga4Breakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-breakdown?dateRange=" + encodeURIComponent(dateRange) + "&propertyId=" + encodeURIComponent(propertyId)),
      fetchJson("revenueSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources"),
      fetchJson("revenueBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-breakdown"),
      fetchJson("hubspotSourceDamageInventory", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory")
    ]);
    var byName = endpointMap(results);
    var campaign = byName.campaign && byName.campaign.data || {};
    var damage = byName.hubspotSourceDamageInventory && byName.hubspotSourceDamageInventory.data || {};
    var selectedGa4CampaignValues = config.selectedGa4CampaignValues !== undefined
      ? arrayValues(config.selectedGa4CampaignValues)
      : parseStoredGa4CampaignFilterForRunner(campaign.ga4CampaignFilter);
    var rows = buildCampaignBreakdownRows(
      byName.ga4Breakdown && byName.ga4Breakdown.data,
      byName.revenueSources && byName.revenueSources.data,
      byName.revenueBreakdown && byName.revenueBreakdown.data,
      selectedGa4CampaignValues
    );
    var targetRow = findCampaignBreakdownRow(rows, targetCampaignName);
    var unchangedRows = namedCampaignBreakdownRows(rows, unchangedCampaignNames);
    var endpointStatuses = results.map(compactEndpointStatus);

    return {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: stage,
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      readonly: true,
      endpointPass: endpointStatuses.every(function (status) { return status.pass === true; }),
      endpointStatus: endpointStatuses,
      inventoryPass: damage.hubspotInventoryPass === true,
      hubspotSummary: damage.hubspotSummary || null,
      hubspotFindings: damage.hubspotFindings || {},
      hubspotFindingCount: Number(damage.hubspotSummary && damage.hubspotSummary.hubspotFindingCount || 0),
      selectedGa4CampaignValues: selectedGa4CampaignValues,
      targetCampaignName: targetCampaignName,
      targetRow: compactCampaignBreakdownRow(targetRow),
      unchangedCampaignNames: unchangedCampaignNames,
      unchangedRows: unchangedRows,
      rowCount: rows.length,
      rows: config.includeRows === true ? rows.map(compactCampaignBreakdownRow) : undefined,
      caveats: [
        "This HubSpot Campaign Breakdown helper is read-only and does not call HubSpot, trigger scheduler, create/edit/delete sources, recompute metrics, send reports, or mutate records.",
        "It mirrors the GA4 Overview Campaign Breakdown endpoint-plus-mapped-source merge; it does not inspect rendered pixels.",
        "A pass proves only the configured campaign/property/date-range row transition and named unchanged rows; Reports, KPI/Benchmark, emails, other campaigns, alternate mappings, and future provider mutations remain separate evidence."
      ]
    };
  }

  async function hubspotCampaignBreakdownBefore(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var label = config.label || "4.11-hubspot-campaign-breakdown-transition";
    var key = storageKey("hubspot-campaign-breakdown-" + label, campaignId);
    var point = await hubspotCampaignBreakdownPoint(config, "before-" + label);
    var checks = {
      endpointsPass: point.endpointPass,
      readonly: point.readonly,
      inventoryPass: point.inventoryPass,
      targetCampaignProvided: !!point.targetCampaignName,
      targetRowPresent: !!point.targetRow,
      targetHubspotRevenuePresent: config.expectTargetHubspotRevenuePresent === undefined ? undefined : (!!(point.targetRow && Number(point.targetRow.hubspotRevenue || 0) > 0) === (config.expectTargetHubspotRevenuePresent !== false)),
      unchangedCampaignNamesProvided: point.unchangedCampaignNames.length > 0,
      unchangedRowsPresent: point.unchangedCampaignNames.length > 0 ? point.unchangedRows.every(function (item) { return !!item.row; }) : false,
      hubspotFindingsClear: point.hubspotFindingCount === 0
    };

    if (config.expectedTargetRevenueBefore !== undefined) {
      checks.targetRevenueBeforeMatchesExpected = !!point.targetRow && closeMoney(point.targetRow.displayedRevenue, config.expectedTargetRevenueBefore);
    }
    if (config.expectedTargetHubspotRevenueBefore !== undefined) {
      checks.targetHubspotRevenueBeforeMatchesExpected = !!point.targetRow && closeMoney(point.targetRow.hubspotRevenue, config.expectedTargetHubspotRevenueBefore);
    }

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var summary = Object.assign({}, point, {
      baselineKey: key,
      expected: {
        targetCampaignName: point.targetCampaignName,
        targetRevenueBefore: config.expectedTargetRevenueBefore,
        targetHubspotRevenueBefore: config.expectedTargetHubspotRevenueBefore,
        unchangedCampaignNames: point.unchangedCampaignNames
      },
      checks: effectiveChecks
    });
    summary.readyForProviderChange = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    summary.overallPass = summary.readyForProviderChange;
    localStorage.setItem(key, JSON.stringify(summary));
    console.log(summary);
    return summary;
  }

  async function hubspotCampaignBreakdownAfter(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var label = config.label || "4.11-hubspot-campaign-breakdown-transition";
    var key = config.baselineKey || storageKey("hubspot-campaign-breakdown-" + label, campaignId);
    var baseline = JSON.parse(localStorage.getItem(key) || "null");
    var point = await hubspotCampaignBreakdownPoint(config, "after-" + label);
    var beforeTarget = baseline && baseline.targetRow || null;
    var afterTarget = point.targetRow || null;
    var expectedTargetRevenueDelta = config.expectedTargetRevenueDelta !== undefined ? config.expectedTargetRevenueDelta : config.expectedRevenueDelta;
    var expectedTargetHubspotRevenueDelta = config.expectedTargetHubspotRevenueDelta !== undefined ? config.expectedTargetHubspotRevenueDelta : expectedTargetRevenueDelta;
    var targetDisplayedRevenueDelta = beforeTarget && afterTarget ? moneyDelta(afterTarget.displayedRevenue, beforeTarget.displayedRevenue) : null;
    var targetHubspotRevenueDelta = beforeTarget && afterTarget ? moneyDelta(afterTarget.hubspotRevenue, beforeTarget.hubspotRevenue) : null;
    var targetNativeRevenueDelta = beforeTarget && afterTarget ? moneyDelta(afterTarget.nativeRevenue, beforeTarget.nativeRevenue) : null;
    var unchangedComparisons = point.unchangedCampaignNames.map(function (name) {
      var beforeEntry = baseline && Array.isArray(baseline.unchangedRows)
        ? baseline.unchangedRows.find(function (item) { return normalizeCampaignBreakdownKey(item.expectedName) === normalizeCampaignBreakdownKey(name); })
        : null;
      var afterEntry = point.unchangedRows.find(function (item) { return normalizeCampaignBreakdownKey(item.expectedName) === normalizeCampaignBreakdownKey(name); }) || null;
      return {
        expectedName: name,
        before: beforeEntry && beforeEntry.row || null,
        after: afterEntry && afterEntry.row || null,
        displayedRevenueDelta: beforeEntry && beforeEntry.row && afterEntry && afterEntry.row
          ? moneyDelta(afterEntry.row.displayedRevenue, beforeEntry.row.displayedRevenue)
          : null,
        hubspotRevenueDelta: beforeEntry && beforeEntry.row && afterEntry && afterEntry.row
          ? moneyDelta(afterEntry.row.hubspotRevenue, beforeEntry.row.hubspotRevenue)
          : null
      };
    });
    var transitionExpectationProvided = expectedTargetRevenueDelta !== undefined && expectedTargetHubspotRevenueDelta !== undefined;

    var checks = {
      baselineFound: !!baseline,
      endpointsPass: point.endpointPass,
      readonly: point.readonly,
      inventoryPass: point.inventoryPass,
      targetRowPresentBefore: !!beforeTarget,
      targetRowPresentAfter: !!afterTarget,
      transitionExpectationProvided: transitionExpectationProvided,
      unchangedCampaignNamesProvided: point.unchangedCampaignNames.length > 0,
      unchangedRowsPresent: point.unchangedCampaignNames.length > 0 && unchangedComparisons.every(function (item) { return !!(item.before && item.after); }),
      hubspotFindingsClear: point.hubspotFindingCount === 0,
      targetNativeRevenueUnchanged: config.expectTargetNativeRevenueUnchanged === false ? undefined : closeMoney(targetNativeRevenueDelta, 0),
      unchangedRowsDisplayedRevenueUnchanged: point.unchangedCampaignNames.length > 0 && unchangedComparisons.every(function (item) { return item.displayedRevenueDelta !== null && closeMoney(item.displayedRevenueDelta, 0); }),
      unchangedRowsHubspotRevenueUnchanged: point.unchangedCampaignNames.length > 0 && unchangedComparisons.every(function (item) { return item.hubspotRevenueDelta !== null && closeMoney(item.hubspotRevenueDelta, 0); })
    };

    if (expectedTargetRevenueDelta !== undefined) {
      checks.targetDisplayedRevenueDeltaMatchesExpected = targetDisplayedRevenueDelta !== null && closeMoney(targetDisplayedRevenueDelta, expectedTargetRevenueDelta);
    }
    if (expectedTargetHubspotRevenueDelta !== undefined) {
      checks.targetHubspotRevenueDeltaMatchesExpected = targetHubspotRevenueDelta !== null && closeMoney(targetHubspotRevenueDelta, expectedTargetHubspotRevenueDelta);
    }
    if (config.expectedTargetRevenueAfter !== undefined) {
      checks.targetRevenueAfterMatchesExpected = !!afterTarget && closeMoney(afterTarget.displayedRevenue, config.expectedTargetRevenueAfter);
    }
    if (config.expectedTargetHubspotRevenueAfter !== undefined) {
      checks.targetHubspotRevenueAfterMatchesExpected = !!afterTarget && closeMoney(afterTarget.hubspotRevenue, config.expectedTargetHubspotRevenueAfter);
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
      selectedGa4CampaignValues: point.selectedGa4CampaignValues,
      expected: {
        targetCampaignName: point.targetCampaignName,
        targetRevenueDelta: expectedTargetRevenueDelta,
        targetHubspotRevenueDelta: expectedTargetHubspotRevenueDelta,
        targetRevenueAfter: config.expectedTargetRevenueAfter,
        targetHubspotRevenueAfter: config.expectedTargetHubspotRevenueAfter,
        unchangedCampaignNames: point.unchangedCampaignNames
      },
      before: baseline ? {
        targetRow: beforeTarget,
        unchangedRows: baseline.unchangedRows || []
      } : null,
      after: {
        targetRow: afterTarget,
        unchangedRows: point.unchangedRows
      },
      deltas: {
        targetDisplayedRevenue: targetDisplayedRevenueDelta,
        targetHubspotRevenue: targetHubspotRevenueDelta,
        targetNativeRevenue: targetNativeRevenueDelta,
        unchangedRows: unchangedComparisons
      },
      endpointStatus: point.endpointStatus,
      inventoryPass: point.inventoryPass,
      hubspotSummary: point.hubspotSummary,
      hubspotFindings: point.hubspotFindings,
      checks: effectiveChecks,
      caveats: point.caveats
    };
    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }
  function reportIncludesOverviewRevenue(report) {
    var type = String(report && report.reportType || "").toLowerCase();
    if (type === "overview") return true;
    if (type !== "custom") return false;
    var cfg = objectValue(report && report.configuration);
    return !!(cfg.sections && cfg.sections.overview === true && cfg.subsections && cfg.subsections.overview && cfg.subsections.overview.revenue === true);
  }

  function reportIncludesOverviewCampaignBreakdown(report) {
    var type = String(report && report.reportType || "").toLowerCase();
    if (type === "overview") return true;
    if (type !== "custom") return false;
    var cfg = objectValue(report && report.configuration);
    return !!(cfg.sections && cfg.sections.overview === true && cfg.subsections && cfg.subsections.overview && cfg.subsections.overview.campaignBreakdown === true);
  }

  function endpointRevenueTotal(data) {
    var totals = data && data.totals || data || {};
    var total = firstNumber(totals, ["revenue", "totalRevenue", "total", "amount"]);
    if (total !== null) return money(total);
    return sumRows(rowsOf(data), ["revenue", "totalRevenue", "amount", "total", "value"]);
  }

  function effectiveSourceType(row, sourceDefinitionsById) {
    var type = sourceType(row);
    if (type) return type;
    var id = String(sourceId(row) || "");
    return sourceType(sourceDefinitionsById.get(id));
  }

  function endpointMetricTotals(data) {
    var totals = data && data.totals || data || {};
    return {
      revenue: money(firstNumber(totals, ["revenue", "totalRevenue", "total", "amount"]) || 0) || 0,
      conversions: money(firstNumber(totals, ["conversions", "totalConversions"]) || 0) || 0,
      sessions: money(firstNumber(totals, ["sessions", "totalSessions"]) || 0) || 0,
      users: money(firstNumber(totals, ["users", "totalUsers"]) || 0) || 0,
      pageviews: money(firstNumber(totals, ["pageviews", "screenPageViews", "views"]) || 0) || 0,
      engagementRate: money(firstNumber(totals, ["engagementRate"]) || 0) || 0
    };
  }

  function summedMetricTotals(data) {
    var rows = rowsOf(data);
    return {
      revenue: sumRows(rows, ["revenue", "totalRevenue", "amount", "total", "value"]) || 0,
      conversions: sumRows(rows, ["conversions", "totalConversions"]) || 0,
      sessions: sumRows(rows, ["sessions", "totalSessions"]) || 0,
      users: sumRows(rows, ["users", "totalUsers"]) || 0,
      pageviews: sumRows(rows, ["pageviews", "screenPageViews", "views"]) || 0,
      engagementRate: money(firstNumber(rows[0] || {}, ["engagementRate"]) || 0) || 0
    };
  }

  function overviewFinancialSourceTotals(ga4ToDateData, ga4BreakdownData, ga4DailyData) {
    var candidates = [
      { source: "ga4-to-date", totals: endpointMetricTotals(ga4ToDateData) },
      { source: "ga4-daily", totals: summedMetricTotals(ga4DailyData) },
      { source: "ga4-breakdown", totals: summedMetricTotals(ga4BreakdownData) }
    ];
    return candidates.reduce(function (best, current) {
      return Number(current.totals.revenue || 0) > Number(best.totals.revenue || 0) ? current : best;
    }, candidates[0]);
  }

  function normalizeFinancialMetricKey(value) {
    var raw = String(value || "").trim();
    var compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (compact === "revenue" || compact === "totalrevenue") return "revenue";
    if (compact === "roas") return "roas";
    if (compact === "roi") return "roi";
    if (compact === "cpa") return "cpa";
    return compact;
  }

  function financialMetricValue(metric, values) {
    var key = normalizeFinancialMetricKey(metric);
    if (key === "revenue") return values.financialRevenue;
    if (key === "roas") return values.roas;
    if (key === "roi") return values.roi;
    if (key === "cpa") return values.cpa;
    return null;
  }

  function rowMetricKeys(row) {
    if (!row) return [];
    var config = objectValue(row.calculationConfig || row.calculation_config || row.config);
    return [
      row.metric,
      row.metricType,
      row.metricKey,
      row.templateName,
      row.template,
      row.name,
      row.label,
      config.metric,
      config.metricType,
      config.metricKey,
      config.templateName,
      config.template
    ].map(normalizeFinancialMetricKey).filter(Boolean);
  }

  function metricRowKey(row) {
    return rowMetricKeys(row)[0] || "";
  }

  function findMetricRow(rows, metric) {
    var key = normalizeFinancialMetricKey(metric);
    return (Array.isArray(rows) ? rows : []).find(function (row) {
      return rowMetricKeys(row).indexOf(key) !== -1;
    }) || null;
  }

  function rowCurrentValue(row) {
    if (!row) return null;
    var keys = ["currentValue", "current", "value", "actualValue"];
    for (var i = 0; i < keys.length; i++) {
      var parsed = formattedNumberOrNull(row[keys[i]]);
      if (parsed !== null) return money(parsed);
    }
    return null;
  }

  function compareMetricRows(rows, metrics, values) {
    return arrayValues(metrics).map(function (metric) {
      var row = findMetricRow(rows, metric);
      var expected = financialMetricValue(metric, values);
      var actual = rowCurrentValue(row);
      return {
        metric: normalizeFinancialMetricKey(metric),
        requestedMetric: String(metric),
        rowPresent: !!row,
        rowId: row && row.id || null,
        rowName: row && (row.name || row.metric) || null,
        rowMetricKeys: rowMetricKeys(row),
        actualCurrentValue: actual,
        expectedCurrentValue: expected,
        matchesExpected: !!row && expected !== null && actual !== null && closeMoney(actual, expected)
      };
    });
  }

  async function hubspotKpiBenchmarkValuePack(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = requireValue(config.propertyId, "propertyId");
    var platformType = config.platformType || "google_analytics";
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var dailyDays = config.dailyDays || 90;
    var requiredKpiMetrics = config.requiredKpiMetrics || [];
    var requiredBenchmarkMetrics = config.requiredBenchmarkMetrics || [];

    var results = await Promise.all([
      fetchJson("ga4ToDate", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-to-date?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)),
      fetchJson("ga4Breakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-breakdown?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)),
      fetchJson("ga4Daily", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-daily?days=" + encodeURIComponent(String(dailyDays)) + "&propertyId=" + encodeURIComponent(propertyId)),
      fetchJson("revenueSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources"),
      fetchJson("revenueBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-breakdown"),
      fetchJson("spendBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-breakdown"),
      fetchJson("hubspotSourceDamageInventory", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"),
      fetchJson("kpis", "/api/platforms/" + encodeURIComponent(platformType) + "/kpis?campaignId=" + encodeURIComponent(campaignId)),
      fetchJson("benchmarks", "/api/platforms/" + encodeURIComponent(platformType) + "/benchmarks?campaignId=" + encodeURIComponent(campaignId))
    ]);
    var byName = endpointMap(results);
    var damage = byName.hubspotSourceDamageInventory && byName.hubspotSourceDamageInventory.data || {};
    var sourceDefinitions = rowsOf(byName.revenueSources && byName.revenueSources.data);
    var sourceDefinitionsById = new Map();
    sourceDefinitions.forEach(function (source) {
      var id = String(sourceId(source) || "");
      if (id) sourceDefinitionsById.set(id, source);
    });
    var revenueBreakdownRows = rowsOf(byName.revenueBreakdown && byName.revenueBreakdown.data);
    var spendBreakdownRows = rowsOf(byName.spendBreakdown && byName.spendBreakdown.data);
    var hubspotRevenueRows = revenueBreakdownRows.filter(function (row) {
      return effectiveSourceType(row, sourceDefinitionsById).indexOf("hubspot") !== -1;
    });
    var importedRevenueForFinancials = sumRows(revenueBreakdownRows, ["revenue", "amount", "totalRevenue", "total", "value"]) || 0;
    var hubspotRevenueForFinancials = sumRows(hubspotRevenueRows, ["revenue", "amount", "totalRevenue", "total", "value"]) || 0;
    var spendForFinancials = sumRows(spendBreakdownRows, ["spend", "amount", "totalSpend", "total", "cost", "value"]) || 0;
    var financialSource = overviewFinancialSourceTotals(
      byName.ga4ToDate && byName.ga4ToDate.data,
      byName.ga4Breakdown && byName.ga4Breakdown.data,
      byName.ga4Daily && byName.ga4Daily.data
    );
    var ga4RevenueForFinancials = money(financialSource.totals.revenue || 0) || 0;
    var financialConversions = money(financialSource.totals.conversions || 0) || 0;
    var financialRevenue = money(Number(ga4RevenueForFinancials || 0) + Number(importedRevenueForFinancials || 0)) || 0;
    var financialROI = spendForFinancials > 0 ? money(((financialRevenue - spendForFinancials) / spendForFinancials) * 100) : 0;
    var financialROAS = spendForFinancials > 0 ? money(financialRevenue / spendForFinancials) : 0;
    var financialCPA = financialConversions > 0 ? money(spendForFinancials / financialConversions) : 0;
    var values = {
      financialRevenue: financialRevenue,
      roas: financialROAS,
      roi: financialROI,
      cpa: financialCPA
    };
    var activeHubspotSources = damage && damage.hubspotProvenance && Array.isArray(damage.hubspotProvenance.activeSources)
      ? damage.hubspotProvenance.activeSources
      : [];
    var pipelineProxyTotalToDate = money(activeHubspotSources.reduce(function (sum, source) {
      var mapping = source && source.mapping || {};
      return sum + Number(mapping.pipelineTotalToDate || 0);
    }, 0)) || 0;
    var kpiRows = Array.isArray(byName.kpis && byName.kpis.data) ? byName.kpis.data : rowsOf(byName.kpis && byName.kpis.data);
    var benchmarkRows = Array.isArray(byName.benchmarks && byName.benchmarks.data) ? byName.benchmarks.data : rowsOf(byName.benchmarks && byName.benchmarks.data);
    if (config.validateConfiguredFinancialMetrics === true) {
      if (arrayValues(requiredKpiMetrics).length === 0) {
        requiredKpiMetrics = ["Revenue", "ROAS", "ROI", "CPA"].filter(function (metric) {
          return compareMetricRows(kpiRows, [metric], values)[0].rowPresent;
        });
      }
      if (arrayValues(requiredBenchmarkMetrics).length === 0) {
        requiredBenchmarkMetrics = ["revenue", "roas", "roi", "cpa"].filter(function (metric) {
          return compareMetricRows(benchmarkRows, [metric], values)[0].rowPresent;
        });
      }
    }
    var kpiComparisons = compareMetricRows(kpiRows, requiredKpiMetrics, values);
    var benchmarkComparisons = compareMetricRows(benchmarkRows, requiredBenchmarkMetrics, values);
    var endpointStatuses = results.map(compactEndpointStatus);

    var checks = {
      endpointsPass: endpointStatuses.every(function (status) { return status.pass === true; }),
      readonly: true,
      kpisEndpointPasses: !!(byName.kpis && byName.kpis.pass),
      benchmarksEndpointPasses: !!(byName.benchmarks && byName.benchmarks.pass),
      inventoryPass: damage.hubspotInventoryPass === true,
      hubspotFindingsClear: Number(damage.hubspotSummary && damage.hubspotSummary.hubspotFindingCount || 0) === 0,
      hubspotRevenuePresent: Number(hubspotRevenueForFinancials || 0) > 0,
      financialRevenueIncludesImportedRevenue: closeMoney(financialRevenue, Number(ga4RevenueForFinancials || 0) + Number(importedRevenueForFinancials || 0)),
      hubspotRevenueIncludedInImportedRevenue: Number(hubspotRevenueForFinancials || 0) > 0 && Number(importedRevenueForFinancials || 0) + 0.01 >= Number(hubspotRevenueForFinancials || 0),
      pipelineProxyExcludedFromKpiBenchmarkRevenue: Number(pipelineProxyTotalToDate || 0) > 0 ? !closeMoney(financialRevenue, Number(ga4RevenueForFinancials || 0) + Number(importedRevenueForFinancials || 0) + Number(pipelineProxyTotalToDate || 0)) : undefined,
      requiredKpiRowsPresent: arrayValues(requiredKpiMetrics).length > 0 ? kpiComparisons.every(function (item) { return item.rowPresent; }) : undefined,
      requiredKpiRowsMatchExpected: arrayValues(requiredKpiMetrics).length > 0 ? kpiComparisons.every(function (item) { return item.matchesExpected; }) : undefined,
      requiredBenchmarkRowsPresent: arrayValues(requiredBenchmarkMetrics).length > 0 ? benchmarkComparisons.every(function (item) { return item.rowPresent; }) : undefined,
      requiredBenchmarkRowsMatchExpected: arrayValues(requiredBenchmarkMetrics).length > 0 ? benchmarkComparisons.every(function (item) { return item.matchesExpected; }) : undefined
    };
    if (config.expectedFinancialRevenue !== undefined) checks.financialRevenueMatchesExpected = closeMoney(financialRevenue, config.expectedFinancialRevenue);
    if (config.expectedHubspotRevenueForFinancials !== undefined) checks.hubspotRevenueMatchesExpected = closeMoney(hubspotRevenueForFinancials, config.expectedHubspotRevenueForFinancials);
    if (config.expectedRoas !== undefined) checks.roasMatchesExpected = closeMoney(financialROAS, config.expectedRoas);
    if (config.expectedRoi !== undefined) checks.roiMatchesExpected = closeMoney(financialROI, config.expectedRoi);
    if (config.expectedCpa !== undefined) checks.cpaMatchesExpected = closeMoney(financialCPA, config.expectedCpa);

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "4.13-hubspot-kpi-benchmark-value-propagation",
      campaignId: campaignId,
      propertyId: propertyId,
      platformType: platformType,
      dateRange: dateRange,
      dailyDays: dailyDays,
      readonly: true,
      financialSource: financialSource.source,
      values: {
        ga4RevenueForFinancials: ga4RevenueForFinancials,
        importedRevenueForFinancials: importedRevenueForFinancials,
        hubspotRevenueForFinancials: hubspotRevenueForFinancials,
        financialRevenue: financialRevenue,
        spendForFinancials: spendForFinancials,
        financialConversions: financialConversions,
        roas: financialROAS,
        roi: financialROI,
        cpa: financialCPA,
        pipelineProxyTotalToDate: pipelineProxyTotalToDate,
        hubspotRevenueSourceIds: hubspotRevenueRows.map(sourceId).filter(Boolean)
      },
      kpis: {
        count: kpiRows.length,
        requiredMetrics: arrayValues(requiredKpiMetrics),
        comparisons: kpiComparisons
      },
      benchmarks: {
        count: benchmarkRows.length,
        requiredMetrics: arrayValues(requiredBenchmarkMetrics),
        comparisons: benchmarkComparisons
      },
      expected: {
        financialRevenue: config.expectedFinancialRevenue,
        hubspotRevenueForFinancials: config.expectedHubspotRevenueForFinancials,
        roas: config.expectedRoas,
        roi: config.expectedRoi,
        cpa: config.expectedCpa
      },
      inventoryPass: damage.hubspotInventoryPass === true,
      hubspotSummary: damage.hubspotSummary || null,
      hubspotFindings: damage.hubspotFindings || {},
      endpointStatus: endpointStatuses,
      checks: effectiveChecks,
      caveats: [
        "This HubSpot KPI/Benchmark helper is read-only and does not create, edit, delete, refresh, recompute, send alerts, send emails, call HubSpot, or mutate records.",
        "It mirrors the GA4 Overview financial formula used by KPI/Benchmark live values: selected GA4 native revenue plus active source-backed imported revenue, with Pipeline Proxy excluded.",
        "A pass proves only the configured GA4 KPI/Benchmark value packet; emails, alert delivery, other campaigns, alternate mappings, other KPI/Benchmark metrics, and future provider mutations remain separate evidence."
      ]
    };
    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }
  async function hubspotReportValuePack(config) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = requireValue(config.propertyId, "propertyId");
    var platformType = config.platformType || "google_analytics";
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var dailyDays = config.dailyDays || 90;
    var targetCampaignName = config.targetCampaignName ? String(config.targetCampaignName) : null;
    var requireSnapshot = config.requireSnapshot === true || config.requirePdf === true;
    var requirePdf = config.requirePdf === true;

    var results = await Promise.all([
      fetchJson("campaign", "/api/campaigns/" + encodeURIComponent(campaignId)),
      fetchJson("ga4ToDate", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-to-date?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)),
      fetchJson("ga4Breakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-breakdown?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)),
      fetchJson("ga4Daily", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-daily?days=" + encodeURIComponent(String(dailyDays)) + "&propertyId=" + encodeURIComponent(propertyId)),
      fetchJson("revenueSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources"),
      fetchJson("revenueBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-breakdown"),
      fetchJson("spendBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/spend-breakdown"),
      fetchJson("hubspotSourceDamageInventory", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"),
      fetchJson("reports", "/api/platforms/" + encodeURIComponent(platformType) + "/reports?campaignId=" + encodeURIComponent(campaignId))
    ]);
    var byName = endpointMap(results);
    var campaign = byName.campaign && byName.campaign.data || {};
    var damage = byName.hubspotSourceDamageInventory && byName.hubspotSourceDamageInventory.data || {};
    var reports = Array.isArray(byName.reports && byName.reports.data) ? byName.reports.data : [];
    var reportId = config.reportId ? String(config.reportId) : null;
    var report = reportId
      ? reports.find(function (row) { return String(row && row.id) === reportId; }) || null
      : reports.find(function (row) { return String(row && row.reportType || "").toLowerCase() === "overview"; }) || reports[0] || null;
    reportId = report ? String(report.id) : reportId;

    var snapshotsResult = null;
    var pdfResult = null;
    var snapshotId = config.snapshotId ? String(config.snapshotId) : null;
    if (reportId && config.checkSnapshots !== false) {
      snapshotsResult = await fetchJson("snapshots", "/api/platforms/" + encodeURIComponent(platformType) + "/reports/" + encodeURIComponent(reportId) + "/snapshots");
      if (!snapshotId) {
        var snapshots = snapshotsResult.data && Array.isArray(snapshotsResult.data.snapshots) ? snapshotsResult.data.snapshots : [];
        snapshotId = snapshots[0] && snapshots[0].id || null;
      }
    }
    if (snapshotId && config.checkPdf !== false) {
      pdfResult = await fetchBlobStatus("snapshotPdf", "/api/report-snapshots/" + encodeURIComponent(snapshotId) + "/pdf");
    }

    var sourceDefinitions = rowsOf(byName.revenueSources && byName.revenueSources.data);
    var sourceDefinitionsById = new Map();
    sourceDefinitions.forEach(function (source) {
      var id = String(sourceId(source) || "");
      if (id) sourceDefinitionsById.set(id, source);
    });
    var revenueBreakdownRows = rowsOf(byName.revenueBreakdown && byName.revenueBreakdown.data);
    var spendBreakdownRows = rowsOf(byName.spendBreakdown && byName.spendBreakdown.data);
    var hubspotRevenueRows = revenueBreakdownRows.filter(function (row) {
      return effectiveSourceType(row, sourceDefinitionsById).indexOf("hubspot") !== -1;
    });
    var importedRevenueForFinancials = sumRows(revenueBreakdownRows, ["revenue", "amount", "totalRevenue", "total", "value"]);
    var hubspotRevenueForFinancials = sumRows(hubspotRevenueRows, ["revenue", "amount", "totalRevenue", "total", "value"]);
    var spendForFinancials = sumRows(spendBreakdownRows, ["spend", "amount", "totalSpend", "total", "cost", "value"]);
    var ga4ToDateRevenue = endpointRevenueTotal(byName.ga4ToDate && byName.ga4ToDate.data);
    var ga4BreakdownRevenue = endpointRevenueTotal(byName.ga4Breakdown && byName.ga4Breakdown.data);
    var ga4DailyRevenue = sumRows(rowsOf(byName.ga4Daily && byName.ga4Daily.data), ["revenue", "totalRevenue", "amount", "total", "value"]);
    var ga4RevenueForFinancials = Math.max(Number(ga4ToDateRevenue || 0), Number(ga4DailyRevenue || 0), Number(ga4BreakdownRevenue || 0));
    ga4RevenueForFinancials = money(ga4RevenueForFinancials);
    var reportFinancialRevenue = money(Number(ga4RevenueForFinancials || 0) + Number(importedRevenueForFinancials || 0));

    var selectedGa4CampaignValues = config.selectedGa4CampaignValues !== undefined
      ? arrayValues(config.selectedGa4CampaignValues)
      : parseStoredGa4CampaignFilterForRunner(campaign.ga4CampaignFilter);
    var rows = buildCampaignBreakdownRows(
      byName.ga4Breakdown && byName.ga4Breakdown.data,
      byName.revenueSources && byName.revenueSources.data,
      byName.revenueBreakdown && byName.revenueBreakdown.data,
      selectedGa4CampaignValues
    );
    var targetRow = targetCampaignName ? findCampaignBreakdownRow(rows, targetCampaignName) : null;
    var activeHubspotSources = damage && damage.hubspotProvenance && Array.isArray(damage.hubspotProvenance.activeSources)
      ? damage.hubspotProvenance.activeSources
      : [];
    var pipelineProxyTotalToDate = money(activeHubspotSources.reduce(function (sum, source) {
      var mapping = source && source.mapping || {};
      return sum + Number(mapping.pipelineTotalToDate || 0);
    }, 0));
    var endpointStatuses = results.map(compactEndpointStatus);
    if (snapshotsResult) endpointStatuses.push(compactEndpointStatus(snapshotsResult));
    if (pdfResult) endpointStatuses.push({
      endpoint: pdfResult.name,
      pass: pdfResult.pass,
      status: pdfResult.status,
      error: pdfResult.error,
      contentType: pdfResult.contentType || undefined,
      bytes: pdfResult.bytes || undefined
    });

    var checks = {
      endpointsPass: endpointStatuses.every(function (status) { return status.pass === true; }),
      readonly: true,
      reportsEndpointPasses: !!(byName.reports && byName.reports.pass),
      reportResolved: !!report,
      reportPlatformMatches: report ? String(report.platformType || platformType).toLowerCase() === String(platformType).toLowerCase() : false,
      reportIncludesOverviewRevenue: report ? reportIncludesOverviewRevenue(report) : false,
      reportIncludesOverviewCampaignBreakdown: targetCampaignName ? (report ? reportIncludesOverviewCampaignBreakdown(report) : false) : undefined,
      inventoryPass: damage.hubspotInventoryPass === true,
      hubspotFindingsClear: Number(damage.hubspotSummary && damage.hubspotSummary.hubspotFindingCount || 0) === 0,
      hubspotRevenuePresent: Number(hubspotRevenueForFinancials || 0) > 0,
      reportFinancialRevenueIncludesImportedRevenue: closeMoney(reportFinancialRevenue, Number(ga4RevenueForFinancials || 0) + Number(importedRevenueForFinancials || 0)),
      hubspotRevenueIncludedInImportedRevenue: Number(hubspotRevenueForFinancials || 0) > 0 && Number(importedRevenueForFinancials || 0) + 0.01 >= Number(hubspotRevenueForFinancials || 0),
      pipelineProxyExcludedFromReportTotal: Number(pipelineProxyTotalToDate || 0) > 0 ? !closeMoney(reportFinancialRevenue, Number(ga4RevenueForFinancials || 0) + Number(importedRevenueForFinancials || 0) + Number(pipelineProxyTotalToDate || 0)) : undefined,
      targetReportRowPresent: targetCampaignName ? !!targetRow : undefined,
      snapshotsEndpointPasses: snapshotsResult ? snapshotsResult.pass : undefined,
      snapshotAvailableWhenRequired: requireSnapshot ? !!snapshotId : undefined,
      pdfEndpointPasses: pdfResult ? pdfResult.pass : undefined,
      pdfLooksLikePdf: pdfResult ? !!(pdfResult.pass && /application\/pdf/i.test(String(pdfResult.contentType || "")) && Number(pdfResult.bytes || 0) > 0) : undefined,
      pdfAvailableWhenRequired: requirePdf ? !!(pdfResult && pdfResult.pass && /application\/pdf/i.test(String(pdfResult.contentType || "")) && Number(pdfResult.bytes || 0) > 0) : undefined
    };
    if (config.expectedImportedRevenueForFinancials !== undefined) {
      checks.importedRevenueMatchesExpected = closeMoney(importedRevenueForFinancials, config.expectedImportedRevenueForFinancials);
    }
    if (config.expectedHubspotRevenueForFinancials !== undefined) {
      checks.hubspotRevenueMatchesExpected = closeMoney(hubspotRevenueForFinancials, config.expectedHubspotRevenueForFinancials);
    }
    if (config.expectedReportFinancialRevenue !== undefined) {
      checks.reportFinancialRevenueMatchesExpected = closeMoney(reportFinancialRevenue, config.expectedReportFinancialRevenue);
    }
    if (config.expectedTargetReportRevenue !== undefined) {
      checks.targetReportRevenueMatchesExpected = !!targetRow && closeMoney(targetRow.displayedRevenue, config.expectedTargetReportRevenue);
    }
    if (config.expectedTargetHubspotRevenue !== undefined) {
      checks.targetHubspotRevenueMatchesExpected = !!targetRow && closeMoney(targetRow.hubspotRevenue, config.expectedTargetHubspotRevenue);
    }

    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "4.12-hubspot-report-value-propagation",
      campaignId: campaignId,
      propertyId: propertyId,
      platformType: platformType,
      dateRange: dateRange,
      dailyDays: dailyDays,
      readonly: true,
      report: report ? {
        reportId: reportId,
        reportName: report.name || report.reportName || null,
        reportType: report.reportType || null,
        platformType: report.platformType || platformType,
        includesOverviewRevenue: reportIncludesOverviewRevenue(report),
        includesOverviewCampaignBreakdown: reportIncludesOverviewCampaignBreakdown(report)
      } : null,
      snapshotId: snapshotId || null,
      reportValues: {
        ga4RevenueForFinancials: ga4RevenueForFinancials,
        importedRevenueForFinancials: importedRevenueForFinancials,
        hubspotRevenueForFinancials: hubspotRevenueForFinancials,
        reportFinancialRevenue: reportFinancialRevenue,
        spendForFinancials: spendForFinancials,
        pipelineProxyTotalToDate: pipelineProxyTotalToDate,
        hubspotRevenueSourceIds: hubspotRevenueRows.map(sourceId).filter(Boolean),
        targetCampaignName: targetCampaignName,
        targetRow: compactCampaignBreakdownRow(targetRow)
      },
      expected: {
        importedRevenueForFinancials: config.expectedImportedRevenueForFinancials,
        hubspotRevenueForFinancials: config.expectedHubspotRevenueForFinancials,
        reportFinancialRevenue: config.expectedReportFinancialRevenue,
        targetReportRevenue: config.expectedTargetReportRevenue,
        targetHubspotRevenue: config.expectedTargetHubspotRevenue
      },
      inventoryPass: damage.hubspotInventoryPass === true,
      hubspotSummary: damage.hubspotSummary || null,
      hubspotFindings: damage.hubspotFindings || {},
      endpointStatus: endpointStatuses,
      checks: effectiveChecks,
      caveats: [
        "This HubSpot Reports helper is read-only and does not create snapshots, send emails, trigger scheduler, call HubSpot, mutate sources, or recompute provider data.",
        "It mirrors the GA4 scheduled/server report value formulas from campaign-access-guarded endpoints; it does not parse rendered PDF text or inspect browser pixels.",
        "A pass proves only the configured GA4 report value packet; KPI/Benchmark, emails, other campaigns, alternate mappings, and future provider mutations remain separate evidence."
      ]
    };
    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }
  function hubspotPortabilityUniqueSorted(values) {
    var seen = {};
    arrayValues(values).forEach(function (value) {
      var key = String(value || "").trim();
      if (key) seen[key] = true;
    });
    return Object.keys(seen).sort();
  }

  function hubspotPortabilitySameValues(left, right) {
    left = hubspotPortabilityUniqueSorted(left);
    right = hubspotPortabilityUniqueSorted(right);
    if (left.length !== right.length) return false;
    for (var i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  function hubspotPortabilitySelectedValues(source) {
    var mapping = source && source.mapping || mappingConfig(source);
    return arrayValues(mapping.selectedValues || mapping.campaignValues || mapping.campaignValue);
  }

  function hubspotPortabilityDuplicateIdsAcrossCampaigns(points, key) {
    var seen = {};
    points.forEach(function (point) {
      arrayValues(point[key]).forEach(function (id) {
        if (!seen[id]) seen[id] = [];
        if (seen[id].indexOf(point.campaignId) === -1) seen[id].push(point.campaignId);
      });
    });
    return Object.keys(seen).filter(function (id) { return seen[id].length > 1; }).map(function (id) {
      return { id: id, campaignIds: seen[id] };
    });
  }

  async function hubspotPortabilityCampaignPoint(config, index) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "campaigns[" + index + "].campaignId");
    var propertyId = requireValue(config.propertyId, "campaigns[" + index + "].propertyId");
    var dateRange = config.dateRange || DEFAULT_DATE_RANGE;
    var dailyDays = config.dailyDays || 90;
    var results = await Promise.all([
      fetchJson("campaign", "/api/campaigns/" + encodeURIComponent(campaignId)),
      fetchJson("ga4ToDate", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-to-date?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)),
      fetchJson("ga4Breakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-breakdown?propertyId=" + encodeURIComponent(propertyId) + "&dateRange=" + encodeURIComponent(dateRange)),
      fetchJson("ga4Daily", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-daily?days=" + encodeURIComponent(String(dailyDays)) + "&propertyId=" + encodeURIComponent(propertyId)),
      fetchJson("revenueSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources"),
      fetchJson("revenueBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-breakdown"),
      fetchJson("hubspotSourceDamageInventory", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory")
    ]);
    var byName = endpointMap(results);
    var campaign = byName.campaign && byName.campaign.data || {};
    var damage = byName.hubspotSourceDamageInventory && byName.hubspotSourceDamageInventory.data || {};
    var sourceDefinitions = rowsOf(byName.revenueSources && byName.revenueSources.data);
    var sourceDefinitionsById = new Map();
    sourceDefinitions.forEach(function (source) {
      var id = String(sourceId(source) || "");
      if (id) sourceDefinitionsById.set(id, source);
    });
    var revenueBreakdownRows = rowsOf(byName.revenueBreakdown && byName.revenueBreakdown.data);
    var hubspotRevenueRows = revenueBreakdownRows.filter(function (row) {
      return effectiveSourceType(row, sourceDefinitionsById).indexOf("hubspot") !== -1;
    });
    var importedRevenueForFinancials = sumRows(revenueBreakdownRows, ["revenue", "amount", "totalRevenue", "total", "value"]);
    var hubspotRevenueForFinancials = sumRows(hubspotRevenueRows, ["revenue", "amount", "totalRevenue", "total", "value"]);
    var ga4FinancialSource = overviewFinancialSourceTotals(
      byName.ga4ToDate && byName.ga4ToDate.data,
      byName.ga4Breakdown && byName.ga4Breakdown.data,
      byName.ga4Daily && byName.ga4Daily.data
    );
    var financialRevenue = money(Number(ga4FinancialSource.totals.revenue || 0) + Number(importedRevenueForFinancials || 0));
    var activeHubspotSources = damage && damage.hubspotProvenance && Array.isArray(damage.hubspotProvenance.activeSources)
      ? damage.hubspotProvenance.activeSources
      : [];
    var activeHubspotSourceIds = hubspotPortabilityUniqueSorted(activeHubspotSources.map(function (source) { return source && (source.sourceId || source.id); }));
    var hubspotRevenueSourceIds = hubspotPortabilityUniqueSorted(hubspotRevenueRows.map(sourceId));
    var selectedValues = hubspotPortabilityUniqueSorted(activeHubspotSources.reduce(function (values, source) {
      return values.concat(hubspotPortabilitySelectedValues(source));
    }, []));
    var activeHubspotRecordCount = activeHubspotSources.reduce(function (sum, source) {
      return sum + Number(source && source.recordCount || 0);
    }, 0);
    var selectedGa4CampaignValues = parseStoredGa4CampaignFilterForRunner(campaign.ga4CampaignFilter);
    var expectedSelectedValues = config.expectedSelectedValues !== undefined ? hubspotPortabilityUniqueSorted(config.expectedSelectedValues) : null;
    var expectedGa4CampaignValues = config.expectedGa4CampaignValues !== undefined ? hubspotPortabilityUniqueSorted(config.expectedGa4CampaignValues) : null;
    var expectedHubspotRevenueProvided = config.expectedHubspotRevenueForFinancials !== undefined;
    var expectedPositiveHubspotRevenue = Number(config.expectedHubspotRevenueForFinancials || 0) > 0;
    var endpointStatuses = results.map(compactEndpointStatus);
    var checks = {
      endpointsPass: endpointStatuses.every(function (status) { return status.pass === true; }),
      readonly: damage.readonly === true,
      campaignEndpointPasses: !!(byName.campaign && byName.campaign.pass),
      inventoryPass: damage.hubspotInventoryPass === true,
      hubspotFindingsClear: Number(damage.hubspotSummary && damage.hubspotSummary.hubspotFindingCount || 0) === 0,
      activeHubspotSourcePresent: activeHubspotSourceIds.length > 0,
      activeHubspotSourceIdsUniqueWithinCampaign: activeHubspotSourceIds.length === activeHubspotSources.filter(function (source) { return !!(source && (source.sourceId || source.id)); }).length,
      activeHubspotSourcesHaveRecords: expectedPositiveHubspotRevenue ? activeHubspotRecordCount > 0 : undefined,
      hubspotRevenueRowsPresent: expectedPositiveHubspotRevenue ? hubspotRevenueRows.length > 0 : undefined,
      hubspotRevenueSourceIdsPresent: expectedPositiveHubspotRevenue ? hubspotRevenueSourceIds.length > 0 : undefined,
      importedRevenueIncludesHubspot: Number(importedRevenueForFinancials || 0) + 0.01 >= Number(hubspotRevenueForFinancials || 0),
      expectedHubspotRevenueProvided: expectedHubspotRevenueProvided,
      hubspotRevenueMatchesExpected: expectedHubspotRevenueProvided ? closeMoney(hubspotRevenueForFinancials, config.expectedHubspotRevenueForFinancials) : false,
      expectedSelectedValuesProvided: expectedSelectedValues !== null,
      selectedValuesMatchExpected: expectedSelectedValues !== null ? hubspotPortabilitySameValues(selectedValues, expectedSelectedValues) : false,
      ga4PlatformContext: activeHubspotSources.every(function (source) {
        var mapping = source && source.mapping || {};
        return String(source && source.platformContext || "ga4").toLowerCase() === "ga4" && String(mapping.platformContext || "ga4").toLowerCase() === "ga4";
      }),
      proofUsesHubspotRowsOnly: true,
      selectedGa4CampaignValuesMatchExpected: expectedGa4CampaignValues !== null ? hubspotPortabilitySameValues(selectedGa4CampaignValues, expectedGa4CampaignValues) : undefined,
      activeHubspotSourceCountMatchesExpected: config.expectedActiveHubspotSourceCount !== undefined ? activeHubspotSourceIds.length === Number(config.expectedActiveHubspotSourceCount) : undefined,
      importedRevenueMatchesExpected: config.expectedImportedRevenueForFinancials !== undefined ? closeMoney(importedRevenueForFinancials, config.expectedImportedRevenueForFinancials) : undefined,
      financialRevenueMatchesExpected: config.expectedFinancialRevenue !== undefined ? closeMoney(financialRevenue, config.expectedFinancialRevenue) : undefined
    };
    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var point = {
      label: config.label || null,
      campaignId: campaignId,
      propertyId: propertyId,
      dateRange: dateRange,
      dailyDays: dailyDays,
      readonly: true,
      activeHubspotSourceIds: activeHubspotSourceIds,
      hubspotRevenueSourceIds: hubspotRevenueSourceIds,
      selectedValues: selectedValues,
      selectedGa4CampaignValues: selectedGa4CampaignValues,
      values: {
        ga4FinancialSource: ga4FinancialSource.source,
        ga4RevenueForFinancials: money(ga4FinancialSource.totals.revenue || 0),
        importedRevenueForFinancials: importedRevenueForFinancials,
        hubspotRevenueForFinancials: hubspotRevenueForFinancials,
        financialRevenue: financialRevenue,
        activeHubspotRecordCount: activeHubspotRecordCount
      },
      expected: {
        hubspotRevenueForFinancials: config.expectedHubspotRevenueForFinancials,
        selectedValues: expectedSelectedValues,
        activeHubspotSourceCount: config.expectedActiveHubspotSourceCount,
        importedRevenueForFinancials: config.expectedImportedRevenueForFinancials,
        financialRevenue: config.expectedFinancialRevenue,
        ga4CampaignValues: expectedGa4CampaignValues
      },
      hubspotSummary: damage.hubspotSummary || null,
      hubspotFindings: damage.hubspotFindings || {},
      endpointStatus: endpointStatuses,
      checks: effectiveChecks
    };
    point.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    return point;
  }

  async function hubspotOtherCampaignPortabilityPack(config) {
    config = config || {};
    var campaignConfigs = Array.isArray(config.campaigns) ? config.campaigns : [];
    if (campaignConfigs.length === 0 && config.campaignId) campaignConfigs = [config];
    var points = await Promise.all(campaignConfigs.map(function (campaignConfig, index) {
      return hubspotPortabilityCampaignPoint(campaignConfig, index);
    }));
    var duplicateActiveSourceIds = hubspotPortabilityDuplicateIdsAcrossCampaigns(points, "activeHubspotSourceIds");
    var duplicateRevenueSourceIds = hubspotPortabilityDuplicateIdsAcrossCampaigns(points, "hubspotRevenueSourceIds");
    var campaignIds = hubspotPortabilityUniqueSorted(points.map(function (point) { return point.campaignId; }));
    var checks = {
      readonly: true,
      campaignConfigsProvided: campaignConfigs.length > 0,
      multipleCampaignsProvided: config.allowSingleCampaign === true || campaignConfigs.length >= 2,
      campaignIdsUnique: campaignIds.length === points.length,
      allCampaignPacketsPass: points.length === campaignConfigs.length && points.every(function (point) { return point.overallPass === true; }),
      activeHubspotSourceIdsUniqueAcrossCampaigns: duplicateActiveSourceIds.length === 0,
      hubspotRevenueSourceIdsUniqueAcrossCampaigns: duplicateRevenueSourceIds.length === 0,
      proofUsesHubspotRowsOnly: true
    };
    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "4.15-hubspot-other-campaign-portability",
      readonly: true,
      campaignCount: points.length,
      campaigns: points,
      duplicateActiveHubspotSourceIdsAcrossCampaigns: duplicateActiveSourceIds,
      duplicateHubspotRevenueSourceIdsAcrossCampaigns: duplicateRevenueSourceIds,
      checks: effectiveChecks,
      caveats: [
        "This HubSpot other-campaign portability helper is read-only and uses GET endpoints only; it does not create, edit, delete, refresh, recompute, send reports/emails, call HubSpot, or mutate records.",
        "A pass proves only the supplied campaign/property entries and expected HubSpot selected values/totals; it does not prove unlisted campaigns, alternate mappings, Reports, KPI/Benchmark, emails, or future provider mutations.",
        "Cross-campaign leakage checks compare active HubSpot source IDs and HubSpot revenue source IDs returned by the deployed endpoints; they do not inspect raw database rows or HubSpot provider objects."
      ]
    };
    summary.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    console.log(summary);
    return summary;
  }
  function hubspotMappingSourceRevenue(source, revenueBreakdownRows) {
    var id = sourceId(source);
    var breakdownRow = id ? revenueBreakdownRows.find(function (row) { return sourceId(row) === id; }) || null : null;
    var breakdownAmount = sourceAmount(breakdownRow, "revenue");
    if (breakdownAmount !== null) return breakdownAmount;
    var sourceRevenue = firstNumber(source, ["revenueTotal", "revenue", "amount", "totalRevenue", "total", "value"]);
    if (sourceRevenue !== null) return money(sourceRevenue);
    return null;
  }

  function hubspotMappingSelectedValues(source) {
    var mapping = source && source.mapping || mappingConfig(source);
    return arrayValues(mapping.selectedValues || mapping.campaignValues || mapping.campaignValue);
  }

  function hubspotMappingResolveSource(activeSources, config) {
    var expectedSourceId = config.expectedSourceId || config.sourceId || null;
    var expectedSelectedValues = config.expectedSelectedValues !== undefined
      ? hubspotPortabilityUniqueSorted(config.expectedSelectedValues)
      : null;
    if (expectedSourceId) {
      return activeSources.find(function (source) {
        return String(source && (source.sourceId || source.id || sourceId(source)) || "") === String(expectedSourceId);
      }) || null;
    }
    if (expectedSelectedValues) {
      return activeSources.find(function (source) {
        return hubspotPortabilitySameValues(hubspotMappingSelectedValues(source), expectedSelectedValues);
      }) || null;
    }
    return activeSources.length === 1 ? activeSources[0] : null;
  }

  async function hubspotAlternateMappingVariantPoint(config, index) {
    config = config || {};
    var campaignId = requireValue(config.campaignId, "variants[" + index + "].campaignId");
    var propertyId = requireValue(config.propertyId, "variants[" + index + "].propertyId");
    var results = await Promise.all([
      fetchJson("campaign", "/api/campaigns/" + encodeURIComponent(campaignId)),
      fetchJson("revenueSources", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-sources"),
      fetchJson("revenueBreakdown", "/api/campaigns/" + encodeURIComponent(campaignId) + "/revenue-breakdown"),
      fetchJson("hubspotSourceDamageInventory", "/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory")
    ]);
    var byName = endpointMap(results);
    var damage = byName.hubspotSourceDamageInventory && byName.hubspotSourceDamageInventory.data || {};
    var sourceDefinitions = rowsOf(byName.revenueSources && byName.revenueSources.data);
    var revenueBreakdownRows = rowsOf(byName.revenueBreakdown && byName.revenueBreakdown.data);
    var provenanceSources = damage && damage.hubspotProvenance && Array.isArray(damage.hubspotProvenance.activeSources)
      ? damage.hubspotProvenance.activeSources
      : [];
    var fallbackHubspotSources = sourceDefinitions.filter(function (source) {
      return sourceActive(source) && sourceType(source).indexOf("hubspot") !== -1;
    });
    var activeHubspotSources = provenanceSources.length > 0 ? provenanceSources : fallbackHubspotSources;
    var activeSource = hubspotMappingResolveSource(activeHubspotSources, config);
    var mapping = activeSource && activeSource.mapping || mappingConfig(activeSource);
    var expectedSourceId = config.expectedSourceId || config.sourceId || null;
    var expectedSelectedValues = config.expectedSelectedValues !== undefined
      ? hubspotPortabilityUniqueSorted(config.expectedSelectedValues)
      : null;
    var selectedValues = activeSource ? hubspotPortabilityUniqueSorted(hubspotMappingSelectedValues(activeSource)) : [];
    var expectedSelectedValuesCount = config.expectedSelectedValuesCount !== undefined
      ? Number(config.expectedSelectedValuesCount)
      : (expectedSelectedValues ? expectedSelectedValues.length : undefined);
    var actualRevenue = activeSource ? hubspotMappingSourceRevenue(activeSource, revenueBreakdownRows) : null;
    var expectedHubspotRevenueProvided = config.expectedHubspotRevenue !== undefined || config.expectedHubspotRevenueForFinancials !== undefined;
    var expectedHubspotRevenue = config.expectedHubspotRevenue !== undefined ? config.expectedHubspotRevenue : config.expectedHubspotRevenueForFinancials;
    var endpointStatuses = results.map(compactEndpointStatus);
    var checks = {
      endpointsPass: endpointStatuses.every(function (status) { return status.pass === true; }),
      readonly: damage.readonly === true,
      campaignEndpointPasses: !!(byName.campaign && byName.campaign.pass),
      inventoryPass: damage.hubspotInventoryPass === true,
      hubspotFindingsClear: Number(damage.hubspotSummary && damage.hubspotSummary.hubspotFindingCount || 0) === 0,
      activeSourceResolved: !!activeSource,
      sourceIdStableEvidenceProvided: !!expectedSourceId,
      expectedSourceIdMatches: expectedSourceId ? !!activeSource && String(activeSource.sourceId || activeSource.id || sourceId(activeSource)) === String(expectedSourceId) : undefined,
      ga4PlatformContext: !!activeSource && String(activeSource.platformContext || "ga4").toLowerCase() === "ga4" && String(mapping.platformContext || "ga4").toLowerCase() === "ga4",
      expectedCampaignPropertyProvided: config.expectedCampaignProperty !== undefined,
      campaignPropertyMatchesExpected: config.expectedCampaignProperty !== undefined ? String(mapping.campaignProperty || "") === String(config.expectedCampaignProperty) : false,
      expectedSelectedValuesProvided: expectedSelectedValues !== null,
      selectedValuesMatchExpected: expectedSelectedValues !== null ? hubspotPortabilitySameValues(selectedValues, expectedSelectedValues) : false,
      selectedValuesCountMatchesExpected: expectedSelectedValuesCount !== undefined ? selectedValues.length === expectedSelectedValuesCount : false,
      expectedRevenuePropertyProvided: config.expectedRevenueProperty !== undefined,
      revenuePropertyMatchesExpected: config.expectedRevenueProperty !== undefined ? String(mapping.revenueProperty || "") === String(config.expectedRevenueProperty) : false,
      expectedDateFieldProvided: config.expectedDateField !== undefined,
      dateFieldMatchesExpected: config.expectedDateField !== undefined ? String(mapping.dateField || "") === String(config.expectedDateField) : false,
      expectedDailyMaterializationProvided: config.expectedDailyMaterialization !== undefined,
      dailyMaterializationMatchesExpected: config.expectedDailyMaterialization !== undefined ? String(mapping.dailyMaterialization || "") === String(config.expectedDailyMaterialization || "") : false,
      expectedHubspotRevenueProvided: expectedHubspotRevenueProvided,
      hubspotRevenueMatchesExpected: expectedHubspotRevenueProvided ? closeMoney(actualRevenue, expectedHubspotRevenue) : false,
      recordCountMatchesExpected: config.expectedRecordCount !== undefined ? Number(activeSource && activeSource.recordCount || 0) === Number(config.expectedRecordCount) : undefined,
      pipelineEnabledMatchesExpected: config.expectedPipelineEnabled !== undefined ? !!(mapping && mapping.pipelineEnabled) === !!config.expectedPipelineEnabled : undefined,
      proofUsesHubspotRowsOnly: true
    };
    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var point = {
      label: config.label || null,
      campaignId: campaignId,
      propertyId: propertyId,
      readonly: true,
      activeSource: activeSource ? {
        sourceId: activeSource.sourceId || activeSource.id || sourceId(activeSource),
        displayName: activeSource.displayName || activeSource.name || null,
        platformContext: activeSource.platformContext || null,
        isActive: activeSource.isActive !== false,
        recordCount: Number(activeSource.recordCount || 0),
        revenueTotal: actualRevenue,
        mapping: {
          platformContext: mapping.platformContext || null,
          campaignProperty: mapping.campaignProperty || null,
          selectedValues: selectedValues,
          selectedValuesCount: selectedValues.length,
          revenueProperty: mapping.revenueProperty || null,
          dateField: mapping.dateField || null,
          pipelineEnabled: mapping.pipelineEnabled === true,
          pipelineStageId: mapping.pipelineStageId || null,
          pipelineStageLabel: mapping.pipelineStageLabel || null,
          dailyMaterialization: mapping.dailyMaterialization || null
        }
      } : null,
      expected: {
        sourceId: expectedSourceId,
        campaignProperty: config.expectedCampaignProperty,
        selectedValues: expectedSelectedValues,
        selectedValuesCount: expectedSelectedValuesCount,
        revenueProperty: config.expectedRevenueProperty,
        dateField: config.expectedDateField,
        dailyMaterialization: config.expectedDailyMaterialization,
        hubspotRevenue: expectedHubspotRevenue,
        recordCount: config.expectedRecordCount,
        pipelineEnabled: config.expectedPipelineEnabled
      },
      activeHubspotSourceIds: hubspotPortabilityUniqueSorted(activeHubspotSources.map(function (source) { return source && (source.sourceId || source.id || sourceId(source)); })),
      hubspotSummary: damage.hubspotSummary || null,
      hubspotFindings: damage.hubspotFindings || {},
      endpointStatus: endpointStatuses,
      checks: effectiveChecks
    };
    point.overallPass = Object.keys(effectiveChecks).every(function (name) { return effectiveChecks[name] === true; });
    return point;
  }

  async function hubspotAlternateMappingMatrixPack(config) {
    config = config || {};
    var variants = Array.isArray(config.variants) ? config.variants : [];
    if (variants.length === 0 && config.campaignId) variants = [config];
    var points = await Promise.all(variants.map(function (variant, index) {
      return hubspotAlternateMappingVariantPoint(variant, index);
    }));
    var labels = hubspotPortabilityUniqueSorted(points.map(function (point, index) { return point.label || "variant-" + index; }));
    var expectedSourceIds = hubspotPortabilityUniqueSorted(variants.map(function (variant) { return variant && (variant.expectedSourceId || variant.sourceId); }));
    var actualSourceIds = hubspotPortabilityUniqueSorted(points.map(function (point) { return point.activeSource && point.activeSource.sourceId; }));
    var checks = {
      readonly: true,
      variantsProvided: variants.length > 0,
      variantLabelsUnique: labels.length === points.length,
      sourceIdsUniqueWhenProvided: expectedSourceIds.length === 0 || expectedSourceIds.length === variants.filter(function (variant) { return !!(variant && (variant.expectedSourceId || variant.sourceId)); }).length,
      allVariantPacketsPass: points.length === variants.length && points.every(function (point) { return point.overallPass === true; }),
      resolvedSourceIdsUniqueWithinMatrix: actualSourceIds.length === points.filter(function (point) { return !!(point.activeSource && point.activeSource.sourceId); }).length,
      proofUsesHubspotRowsOnly: true
    };
    var effectiveChecks = Object.keys(checks).reduce(function (map, name) {
      if (checks[name] !== undefined) map[name] = checks[name];
      return map;
    }, {});
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: config.stage || "4.16-hubspot-alternate-mapping-matrix",
      readonly: true,
      variantCount: points.length,
      variants: points,
      checks: effectiveChecks,
      caveats: [
        "This HubSpot alternate mapping matrix helper is read-only and uses GET endpoints only; it does not create, edit, delete, refresh, recompute, send reports/emails, call HubSpot, or mutate records.",
        "It validates persisted source provenance, daily materialization metadata, and revenue breakdown totals for supplied variants only; it does not inspect raw daily row dates, raw HubSpot provider objects, or rendered UI pixels.",
        "Source-ID stability is evidence only when the expectedSourceId was captured from a separate before/after edit flow; unlisted mappings and future provider mutations remain unproven."
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

  var HUBSPOT_H10_REQUIREMENTS = {
    authenticationAndOwnership: ["oauthConnectPass", "tokenRefreshPass", "unauthorizedCampaignRejected"],
    lifecycle: ["addPass", "editPass", "deletePass", "disconnectPass"],
    failureRetention: ["providerFailureRetainsLastGood", "writeFailureRetainsLastGood", "paginationFailureRetainsLastGood", "disconnectFailureRetainsLastGood"],
    dateMappingAndPipelineVariants: ["supportedDateVariantsPass", "mappingVariantsPass", "pipelineVariantsPass"],
    schedulerAndReprocessing: ["normalRefreshPass", "sameSourceReprocessPass", "timeoutRetryPass", "lastGoodRetentionPass"],
    proxyContract: ["transitionPass", "overviewExclusionPass", "reportExclusionPass"],
    downstreamValues: ["overviewPass", "campaignBreakdownPass", "adComparisonPass", "campaignDeepDivePass", "kpiPass", "benchmarkPass"],
    reportsAndDelivery: ["reportPass", "snapshotPass", "pdfPass", "emailAcceptedPass", "emailDeliveryConfirmed"],
    notifications: ["notificationValuePass", "alertValuePass", "campaignIsolationPass"],
    multiCampaignIsolation: ["twoCampaignsPass", "sourceIdsIsolated", "valuesIsolated", "concurrentRefreshIsolated"],
    damagedDataInventory: ["readOnlyInventoryPass", "noUnexpectedDamage", "automaticCleanupBlocked"]
  };

  function hubspotH10EvidenceEntry(name, entry, deploymentCommit, deploymentId) {
    var requiredChecks = HUBSPOT_H10_REQUIREMENTS[name];
    var checks = entry && entry.checks && typeof entry.checks === "object" ? entry.checks : {};
    var capturedAt = entry && entry.capturedAt ? String(entry.capturedAt) : "";
    var artifact = entry && entry.artifact && typeof entry.artifact === "object" ? entry.artifact : null;
    var validation = {
      evidencePresent: !!entry,
      evidenceIdPresent: !!(entry && entry.evidenceId),
      deploymentCommitMatches: !!(entry && entry.deploymentCommit === deploymentCommit),
      deploymentIdMatches: !!(entry && entry.deploymentId === deploymentId),
      capturedAtValid: !!capturedAt && !Number.isNaN(Date.parse(capturedAt)),
      artifactPasses: !!artifact && artifact.overallPass === true,
      requiredChecksPass: requiredChecks.every(function (check) { return checks[check] === true; })
    };
    return {
      category: name,
      evidenceId: entry && entry.evidenceId || null,
      capturedAt: capturedAt || null,
      requiredChecks: requiredChecks,
      missingOrFailedChecks: requiredChecks.filter(function (check) { return checks[check] !== true; }),
      validation: validation,
      overallPass: Object.keys(validation).every(function (check) { return validation[check] === true; })
    };
  }

  function hubspotCleanCertificationGate(config) {
    config = config || {};
    var deploymentCommit = requireValue(config.deploymentCommit, "deploymentCommit");
    var deploymentId = requireValue(config.deploymentId, "deploymentId");
    var evidence = config.evidence && typeof config.evidence === "object" ? config.evidence : {};
    var categories = Object.keys(HUBSPOT_H10_REQUIREMENTS).map(function (name) {
      return hubspotH10EvidenceEntry(name, evidence[name], deploymentCommit, deploymentId);
    });
    var evidenceIds = categories.map(function (category) { return category.evidenceId; }).filter(Boolean);
    var checks = {
      allRequiredCategoriesPresent: categories.every(function (category) { return category.validation.evidencePresent; }),
      allEvidenceIdsUnique: evidenceIds.length === categories.length && new Set(evidenceIds).size === evidenceIds.length,
      allCategoryPacketsPass: categories.every(function (category) { return category.overallPass === true; })
    };
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: "hubspot-h10-clean-certification-gate",
      deploymentCommit: deploymentCommit,
      deploymentId: deploymentId,
      categoryCount: categories.length,
      passedCategoryCount: categories.filter(function (category) { return category.overallPass; }).length,
      categories: categories,
      openCategories: categories.filter(function (category) { return !category.overallPass; }).map(function (category) { return category.category; }),
      caveats: [
        "This gate is pure and read-only: it performs no fetches, provider calls, source mutations, refreshes, recomputes, cleanup, report sends, or notification actions.",
        "It validates the completeness and consistency of supplied deployed evidence metadata; it does not independently reproduce or authenticate the underlying artifacts.",
        "A pass is eligible for strict review only when every attached artifact is retained and independently verified under PRODUCTION_READINESS.md."
      ],
      checks: checks
    };
    summary.overallPass = Object.keys(checks).every(function (name) { return checks[name] === true; });
    console.log(summary);
    return summary;
  }

  function hubspotH10CollectedArtifact(category, packets) {
    var retainedPackets = Object.keys(packets || {}).reduce(function (map, name) {
      if (packets[name]) map[name] = packets[name];
      return map;
    }, {});
    var packetNames = Object.keys(retainedPackets);
    return {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: "hubspot-h10a-" + category,
      packetNames: packetNames,
      packets: retainedPackets,
      overallPass: packetNames.length > 0 && packetNames.every(function (name) {
        return retainedPackets[name].overallPass === true;
      })
    };
  }

  function hubspotH10CollectedEntry(category, config, packets, checks) {
    var artifact = hubspotH10CollectedArtifact(category, packets);
    return {
      evidenceId: "h10a-" + category + "-" + String(config.deploymentId),
      deploymentCommit: String(config.deploymentCommit),
      deploymentId: String(config.deploymentId),
      capturedAt: artifact.checkedAt,
      artifact: artifact,
      checks: checks
    };
  }

  function hubspotH10BuildCollectedEvidence(config, artifacts) {
    var evidence = {};
    var inventory = artifacts.inventory || null;
    var mapping = artifacts.mapping || null;
    var pipeline = artifacts.pipeline || null;
    var overview = artifacts.overview || null;
    var report = artifacts.report || null;
    var kpiBenchmark = artifacts.kpiBenchmark || null;
    var portability = artifacts.portability || null;

    if (mapping) {
      evidence.dateMappingAndPipelineVariants = hubspotH10CollectedEntry("dateMappingAndPipelineVariants", config, { mapping: mapping }, {
        mappingVariantsPass: mapping.overallPass === true
      });
    }
    if (pipeline || report) {
      evidence.proxyContract = hubspotH10CollectedEntry("proxyContract", config, { pipeline: pipeline, report: report }, {
        overviewExclusionPass: !!(pipeline && pipeline.checks && pipeline.checks.pipelineNotAddedToConfirmedRevenue === true),
        reportExclusionPass: !!(report && report.checks && report.checks.pipelineProxyExcludedFromReportTotal === true)
      });
    }
    if (overview || report || kpiBenchmark) {
      evidence.downstreamValues = hubspotH10CollectedEntry("downstreamValues", config, {
        overview: overview,
        report: report,
        kpiBenchmark: kpiBenchmark
      }, {
        overviewPass: !!(overview && overview.overallPass === true && kpiBenchmark && kpiBenchmark.checks && kpiBenchmark.checks.hubspotRevenuePresent === true),
        campaignBreakdownPass: !!(report && report.checks && report.checks.targetReportRowPresent === true),
        kpiPass: !!(kpiBenchmark && kpiBenchmark.checks && kpiBenchmark.checks.requiredKpiRowsMatchExpected === true),
        benchmarkPass: !!(kpiBenchmark && kpiBenchmark.checks && kpiBenchmark.checks.requiredBenchmarkRowsMatchExpected === true)
      });
    }
    if (report) {
      evidence.reportsAndDelivery = hubspotH10CollectedEntry("reportsAndDelivery", config, { report: report }, {
        reportPass: report.overallPass === true,
        snapshotPass: !!(report.checks && report.checks.snapshotsEndpointPasses === true && report.checks.snapshotAvailableWhenRequired === true),
        pdfPass: !!(report.checks && report.checks.pdfAvailableWhenRequired === true)
      });
    }
    if (portability) {
      evidence.multiCampaignIsolation = hubspotH10CollectedEntry("multiCampaignIsolation", config, { portability: portability }, {
        twoCampaignsPass: portability.overallPass === true && Number(portability.campaignCount || 0) >= 2,
        sourceIdsIsolated: !!(portability.checks && portability.checks.activeHubspotSourceIdsUniqueAcrossCampaigns === true && portability.checks.hubspotRevenueSourceIdsUniqueAcrossCampaigns === true),
        valuesIsolated: !!(portability.checks && portability.checks.allCampaignPacketsPass === true)
      });
    }
    if (inventory) {
      evidence.damagedDataInventory = hubspotH10CollectedEntry("damagedDataInventory", config, { inventory: inventory }, {
        readOnlyInventoryPass: inventory.overallPass === true && inventory.readonly === true,
        noUnexpectedDamage: inventory.inventoryPass === true,
        automaticCleanupBlocked: !!(inventory.cleanupAssessment && inventory.cleanupAssessment.automaticCleanupAllowed === false)
      });
    }

    return evidence;
  }

  function hubspotH10CollectionFailure(name, error) {
    return {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: "hubspot-h10a-" + name + "-collection-failure",
      overallPass: false,
      error: String(error && error.message || error)
    };
  }

  async function hubspotH10CollectEvidence(config) {
    config = config || {};
    var deploymentCommit = requireValue(config.deploymentCommit, "deploymentCommit");
    var deploymentId = requireValue(config.deploymentId, "deploymentId");
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = requireValue(config.propertyId, "propertyId");
    var base = { campaignId: campaignId, propertyId: propertyId, dateRange: config.dateRange || DEFAULT_DATE_RANGE };
    var tasks = {
      inventory: function () { return hubspotInventory(Object.assign({}, base, config.inventory || {})); },
      provenance: function () { return hubspotProvenance(Object.assign({ allowAnyActiveSourceCount: true }, base, config.provenance || {})); },
      overview: function () { return overviewPack(Object.assign({}, base, config.overview || {})); },
      report: function () { return hubspotReportValuePack(Object.assign({ requireSnapshot: true, requirePdf: true }, base, config.report || {})); },
      kpiBenchmark: function () { return hubspotKpiBenchmarkValuePack(Object.assign({
        validateConfiguredFinancialMetrics: true
      }, base, config.kpiBenchmark || {})); }
    };
    if (config.pipeline) tasks.pipeline = function () { return hubspotPipelineProxy(Object.assign({}, base, config.pipeline)); };
    if (Array.isArray(config.variants) && config.variants.length > 0) tasks.mapping = function () {
      return hubspotAlternateMappingMatrixPack({ variants: config.variants });
    };
    if (Array.isArray(config.campaigns) && config.campaigns.length > 0) tasks.portability = function () {
      return hubspotOtherCampaignPortabilityPack({ campaigns: config.campaigns });
    };

    var names = Object.keys(tasks);
    var values = await Promise.all(names.map(function (name) {
      return Promise.resolve().then(tasks[name]).catch(function (error) { return hubspotH10CollectionFailure(name, error); });
    }));
    var artifacts = names.reduce(function (map, name, index) {
      map[name] = values[index];
      return map;
    }, {});
    var gateConfig = { deploymentCommit: deploymentCommit, deploymentId: deploymentId };
    var evidence = hubspotH10BuildCollectedEvidence(gateConfig, artifacts);
    var gate = hubspotCleanCertificationGate({
      deploymentCommit: deploymentCommit,
      deploymentId: deploymentId,
      evidence: evidence
    });
    var nextCategory = gate.openCategories[0] || null;
    var nextCategoryResult = nextCategory ? gate.categories.find(function (category) { return category.category === nextCategory; }) : null;
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: "hubspot-h10a-automated-evidence-collection",
      deploymentCommit: deploymentCommit,
      deploymentId: deploymentId,
      readonly: true,
      artifactNames: names,
      artifacts: artifacts,
      evidence: evidence,
      certificationGate: gate,
      nextAction: nextCategoryResult ? {
        category: nextCategoryResult.category,
        missingOrFailedChecks: nextCategoryResult.missingOrFailedChecks
      } : null,
      caveats: [
        "This collector uses existing read-only GET/PDF packets only and does not connect OAuth, mutate sources, trigger refresh, call HubSpot, send email, or change notifications.",
        "Missing lifecycle, failure, transition, notification, concurrent-refresh, and delivery checks remain open; the collector never converts local tests or absent deployed evidence into passing attestations.",
        "certificationGate.overallPass, not artifact collection completion, is the strict certification result."
      ]
    };
    summary.overallPass = gate.overallPass === true;
    console.log(summary);
    return summary;
  }

  function hubspotH10cLatestTimestamp(values) {
    return values.filter(Boolean).sort().slice(-1)[0] || null;
  }

  async function hubspotH10cLifecycleSchedulerPack(config) {
    config = config || {};
    var deploymentCommit = requireValue(config.deploymentCommit, "deploymentCommit");
    var deploymentId = requireValue(config.deploymentId, "deploymentId");
    var campaignId = requireValue(config.campaignId, "campaignId");
    var propertyId = requireValue(config.propertyId, "propertyId");
    var h10a = await hubspotH10CollectEvidence(config);
    var artifacts = Object.assign({}, h10a.artifacts);
    var provenance = artifacts.provenance || {};
    var activeSources = Array.isArray(provenance.activeSources) ? provenance.activeSources : [];

    if (!artifacts.mapping && activeSources.length > 0) {
      var variants = activeSources.map(function (source, index) {
        var mapping = source && source.mapping || {};
        return {
          label: "active-source-" + String(index + 1),
          campaignId: campaignId,
          propertyId: propertyId,
          expectedSourceId: source.sourceId,
          expectedCampaignProperty: mapping.campaignProperty,
          expectedSelectedValues: mapping.selectedValues || [],
          expectedRevenueProperty: mapping.revenueProperty,
          expectedDateField: mapping.dateField,
          expectedDailyMaterialization: mapping.dailyMaterialization,
          expectedHubspotRevenue: source.revenueTotal,
          expectedRecordCount: source.recordCount
        };
      });
      artifacts.mapping = await hubspotAlternateMappingMatrixPack({ variants: variants })
        .catch(function (error) { return hubspotH10CollectionFailure("mapping", error); });
    }

    if (!artifacts.pipeline) {
      var pipelineSource = activeSources.find(function (source) {
        return source && source.mapping && source.mapping.pipelineEnabled === true && Number(source.mapping.pipelineTotalToDate || 0) > 0;
      });
      var overviewRevenue = artifacts.overview && artifacts.overview.financial && artifacts.overview.financial.revenueBreakdownTotal;
      if (pipelineSource && overviewRevenue !== undefined && overviewRevenue !== null) {
        artifacts.pipeline = await hubspotPipelineProxy({
          campaignId: campaignId,
          propertyId: propertyId,
          sourceId: pipelineSource.sourceId,
          expectedConfirmedRevenueTotal: overviewRevenue,
          expectedPipelineTotalToDate: pipelineSource.mapping.pipelineTotalToDate,
          expectedSelectedValues: pipelineSource.mapping.selectedValues || []
        }).catch(function (error) { return hubspotH10CollectionFailure("pipeline", error); });
      }
    }

    var gateConfig = { deploymentCommit: deploymentCommit, deploymentId: deploymentId };
    var evidence = hubspotH10BuildCollectedEvidence(gateConfig, artifacts);
    var gate = hubspotCleanCertificationGate({
      deploymentCommit: deploymentCommit,
      deploymentId: deploymentId,
      evidence: evidence
    });
    var sourceSyncTimestamps = activeSources.map(function (source) {
      return source && source.mapping && source.mapping.lastSyncedAt || null;
    }).filter(Boolean);
    var inventoryPass = artifacts.inventory && artifacts.inventory.overallPass === true;
    var provenancePass = provenance.overallPass === true;
    var currentStatePass = inventoryPass && provenancePass;
    var freshness = artifacts.overview && artifacts.overview.ga4 || {};
    var mappingPass = artifacts.mapping && artifacts.mapping.overallPass === true;
    var pipelineConfiguredCount = activeSources.filter(function (source) {
      return source && source.mapping && source.mapping.pipelineEnabled === true;
    }).length;
    var pipelinePositiveCount = activeSources.filter(function (source) {
      return source && source.mapping && source.mapping.pipelineEnabled === true && Number(source.mapping.pipelineTotalToDate || 0) > 0;
    }).length;
    var coverage = {
      lifecycle: {
        currentStatePass: currentStatePass,
        localRegressionFiles: ["server/hubspot-revenue-transaction.test.ts", "server/hubspot-ga4-disconnect-transaction.test.ts"],
        deployedAddEditDeleteDisconnectEventProven: false,
        status: "local-contract-and-deployed-current-state-only"
      },
      failureRetention: {
        lastGoodCurrentStatePass: currentStatePass,
        localRegressionFiles: ["server/hubspot-revenue-transaction.test.ts", "server/hubspot-pagination.test.ts", "server/hubspot-ga4-disconnect-transaction.test.ts"],
        deployedForcedFailureEventProven: false,
        status: "local-contract-and-deployed-current-state-only"
      },
      schedulerReprocessing: {
        activeSourceCount: activeSources.length,
        sourceSyncTimestampCount: sourceSyncTimestamps.length,
        allActiveSourcesHaveSyncTimestamp: activeSources.length > 0 && sourceSyncTimestamps.length === activeSources.length,
        latestSourceSyncedAt: hubspotH10cLatestTimestamp(sourceSyncTimestamps),
        ga4DailyFresh: freshness.refreshIsStale === false,
        dataThroughDate: freshness.dataThroughDate || null,
        dailyLatestDate: freshness.dailyLatestDate || null,
        persistedSchedulerEventAuditAvailable: false,
        deployedSchedulerEventProven: false,
        status: "current-state-only-no-persisted-event-audit"
      },
      mapping: {
        activeSourceCount: activeSources.length,
        derivedVariantCount: artifacts.mapping && Number(artifacts.mapping.variantCount || 0),
        deployedConsistencyPacketPass: mappingPass
      },
      pipelineProxy: {
        configuredSourceCount: pipelineConfiguredCount,
        positiveProxySourceCount: pipelinePositiveCount,
        deployedPositivePacketPass: artifacts.pipeline ? artifacts.pipeline.overallPass === true : false,
        transitionEventProven: false
      },
      downstreamIsolation: {
        reportPacketPass: artifacts.report && artifacts.report.overallPass === true,
        kpiBenchmarkPacketPass: artifacts.kpiBenchmark && artifacts.kpiBenchmark.overallPass === true,
        multiCampaignPacketPass: artifacts.portability && artifacts.portability.overallPass === true,
        adComparisonDeployedProven: false,
        campaignDeepDiveDeployedProven: false
      },
      staleDaily: {
        pass: freshness.refreshIsStale === false,
        dataThroughDate: freshness.dataThroughDate || null,
        dailyLatestDate: freshness.dailyLatestDate || null
      }
    };
    var remainingActions = [
      "Retain one controlled deployed lifecycle before/after artifact for add/edit/delete/disconnect.",
      "Retain one controlled scheduler/provider before/after artifact; no persisted scheduler event audit currently exists.",
      "Retain forced-failure evidence outside production fault injection and verify last-good state with this read-only pack.",
      "Retain positive Pipeline Proxy transition evidence when a positive proxy fixture is available.",
      "Retain Ad Comparison, Campaign DeepDive, multi-campaign, notification, OAuth, and email-delivery evidence."
    ];
    var summary = {
      runnerVersion: VERSION,
      checkedAt: new Date().toISOString(),
      stage: "hubspot-h10c-lifecycle-scheduler-evidence",
      deploymentCommit: deploymentCommit,
      deploymentId: deploymentId,
      readonly: true,
      coverage: coverage,
      artifactResults: Object.keys(artifacts).reduce(function (map, name) {
        map[name] = { overallPass: artifacts[name] && artifacts[name].overallPass === true, error: artifacts[name] && artifacts[name].error || null };
        return map;
      }, {}),
      evidence: evidence,
      certificationGate: gate,
      remainingActions: remainingActions,
      caveats: [
        "This one-run pack is read-only and does not create/edit/delete/disconnect sources, call HubSpot, trigger scheduler, inject failures, send email, or mutate notifications.",
        "Lifecycle and failure-retention contracts have local regression evidence, but deployed events remain open until retained controlled artifacts exist.",
        "Source lastSyncedAt proves persisted current state, not which scheduler invocation produced it; no persisted HubSpot scheduler event audit exists."
      ]
    };
    summary.overallPass = gate.overallPass === true;
    console.log({
      runnerVersion: summary.runnerVersion,
      overallPass: summary.overallPass,
      coverage: summary.coverage,
      openCategories: gate.openCategories,
      remainingActions: remainingActions
    });
    return summary;
  }

  function help() {
    var examples = [
      "await import('/ga4-overview-validation-runner.js?v=2026-07-12.6')",
      "await GA4OverviewValidation.overviewPack({ campaignId, propertyId })",
      "await GA4OverviewValidation.reportPack({ campaignId, reportId, createSnapshot: true })",
      "await GA4OverviewValidation.sourceDamageInventory({ campaignId })",
      "await GA4OverviewValidation.csvRevenueInventory({ campaignId, expectedInactiveSourceIds: [] })",
      "await GA4OverviewValidation.csvRevenueBefore('csv10-add', { campaignId, propertyId })",
      "await GA4OverviewValidation.csvRevenueAfter('csv10-add', { campaignId, propertyId, targetSourceId: sourceId, targetShouldExist: true, expectedTargetAmount: 150, expectedRevenueDelta: 150, expectedRevenueSourceCountDelta: 1 })",
      "await GA4OverviewValidation.hubspotInventory({ campaignId })",
      "await GA4OverviewValidation.hubspotProvenance({ campaignId, expectedPipelineEnabled: false })",
      "await GA4OverviewValidation.hubspotPipelineProxy({ campaignId, propertyId, expectedConfirmedRevenueTotal: 7600, expectedPipelineTotalToDate: 1234.56, expectedSelectedValues: ['CAMPAIGN_VALUE'] })",
      "await GA4OverviewValidation.hubspotProxyTransitionBefore({ campaignId, propertyId, label: '4.10-hubspot-proxy-to-confirmed-transition', expectedPipelineTotalBefore: 5000, expectedConfirmedRevenueBefore: 7600 })",
      "await GA4OverviewValidation.hubspotProxyTransitionAfter({ campaignId, propertyId, label: '4.10-hubspot-proxy-to-confirmed-transition', expectedProxyDelta: -5000, expectedConfirmedRevenueDelta: 5000 })",
      "await GA4OverviewValidation.hubspotCampaignBreakdownBefore({ campaignId, propertyId, label: '4.11-hubspot-campaign-breakdown-transition', targetCampaignName: 'GA4_CAMPAIGN_ROW', unchangedCampaignNames: ['UNCHANGED_ROW'], expectedTargetRevenueBefore: 7000, expectedTargetHubspotRevenueBefore: 7000 })",
      "await GA4OverviewValidation.hubspotCampaignBreakdownAfter({ campaignId, propertyId, label: '4.11-hubspot-campaign-breakdown-transition', targetCampaignName: 'GA4_CAMPAIGN_ROW', unchangedCampaignNames: ['UNCHANGED_ROW'], expectedTargetRevenueDelta: 5000, expectedTargetHubspotRevenueDelta: 5000 })",
      "await GA4OverviewValidation.hubspotReportValuePack({ campaignId, propertyId, reportId, targetCampaignName: 'GA4_CAMPAIGN_ROW', expectedTargetHubspotRevenue: 5000, requirePdf: true })",
      "await GA4OverviewValidation.hubspotKpiBenchmarkValuePack({ campaignId, propertyId, requiredKpiMetrics: ['Revenue', 'ROAS', 'ROI', 'CPA'], requiredBenchmarkMetrics: ['revenue', 'roas', 'roi', 'cpa'] })",
      "await GA4OverviewValidation.hubspotOtherCampaignPortabilityPack({ campaigns: [{ campaignId: 'CAMPAIGN_A', propertyId: 'PROPERTY_A', expectedHubspotRevenueForFinancials: 1000, expectedSelectedValues: ['CRM_VALUE_A'] }, { campaignId: 'CAMPAIGN_B', propertyId: 'PROPERTY_B', expectedHubspotRevenueForFinancials: 2000, expectedSelectedValues: ['CRM_VALUE_B'] }] })",
      "await GA4OverviewValidation.hubspotAlternateMappingMatrixPack({ variants: [{ label: 'dealname-amount-closedate', campaignId: 'CAMPAIGN_ID', propertyId: 'PROPERTY_ID', expectedSourceId: 'SOURCE_ID', expectedCampaignProperty: 'dealname', expectedSelectedValues: ['CRM_VALUE'], expectedRevenueProperty: 'amount', expectedDateField: 'closedate', expectedDailyMaterialization: 'selected_date_field_v1', expectedHubspotRevenue: 8000, expectedRecordCount: 2 }] })",
      "GA4OverviewValidation.hubspotCleanCertificationGate({ deploymentCommit: 'DEPLOYED_COMMIT', deploymentId: 'PRODUCTION_DEPLOYMENT_ID', evidence: h10Evidence })",
      "await GA4OverviewValidation.hubspotH10CollectEvidence({ deploymentCommit: 'DEPLOYED_COMMIT', deploymentId: 'PRODUCTION_DEPLOYMENT_ID', campaignId, propertyId, report: { targetCampaignName: 'GA4_CAMPAIGN_ROW' }, pipeline: { expectedConfirmedRevenueTotal: 7600, expectedPipelineTotalToDate: 5000 }, variants: mappingVariants, campaigns: campaignVariants })",
      "await GA4OverviewValidation.hubspotH10cLifecycleSchedulerPack({ deploymentCommit: 'DEPLOYED_COMMIT', deploymentId: 'PRODUCTION_DEPLOYMENT_ID', campaignId, propertyId })",
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
    csvRevenueBefore: csvRevenueBefore,
    csvRevenueAfter: csvRevenueAfter,
    refreshSpend: refreshSpend,
    refreshRevenue: refreshRevenue,
    overviewPack: overviewPack,
    reportPack: reportPack,
    sourceDamageInventory: sourceDamageInventory,
    csvRevenueInventory: csvRevenueInventory,
    hubspotInventory: hubspotInventory,
    hubspotProvenance: hubspotProvenance,
    hubspotPipelineProxy: hubspotPipelineProxy,
    hubspotProxyTransitionBefore: hubspotProxyTransitionBefore,
    hubspotProxyTransitionAfter: hubspotProxyTransitionAfter,
    hubspotCampaignBreakdownBefore: hubspotCampaignBreakdownBefore,
    hubspotCampaignBreakdownAfter: hubspotCampaignBreakdownAfter,
    hubspotReportValuePack: hubspotReportValuePack,
    hubspotKpiBenchmarkValuePack: hubspotKpiBenchmarkValuePack,
    hubspotOtherCampaignPortabilityPack: hubspotOtherCampaignPortabilityPack,
    hubspotAlternateMappingMatrixPack: hubspotAlternateMappingMatrixPack,
    hubspotCleanCertificationGate: hubspotCleanCertificationGate,
    hubspotH10BuildCollectedEvidence: hubspotH10BuildCollectedEvidence,
    hubspotH10CollectEvidence: hubspotH10CollectEvidence,
    hubspotH10cLifecycleSchedulerPack: hubspotH10cLifecycleSchedulerPack,
    hubspotPropagationBefore: hubspotPropagationBefore,
    hubspotPropagationAfter: hubspotPropagationAfter,
    googleSheetsVariantPack: googleSheetsVariantPack,
    help: help
  };

  console.log("GA4OverviewValidation loaded", { version: VERSION });
})();

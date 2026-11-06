import { PDFParse } from "pdf-parse";
import { compareNumber, dateIsValid, monitorHash, numberOrNull, parseMonitorMapping, type LiveNumberSnapshot, type NumberCheck } from "./live-number-checks";
import { expectedOutputNumbers, expectedTargetNumbers } from "./live-number-output-checks";

const diagnosticTypes = ["performance-summary", "financial-analysis", "trend-analysis", "executive-summary"];
export function checkDiagnosticReportText(snapshot: LiveNumberSnapshot, text: string, type: string, now = new Date()): NumberCheck[] {
  const expected = expectedOutputNumbers(snapshot, now), section = `Generated ${type} PDF`, checks: NumberCheck[] = [];
  const boundaries: Record<string, [string, string]> = {
    "performance-summary": ["Key Outcomes", "Campaign Health"], "financial-analysis": ["Financial Position", "Allocation & Sources"],
    "trend-analysis": ["Current Decision Metrics", "Campaign Performance Trend"], "executive-summary": ["Marketing Funnel Performance", "KPI Exceptions"],
  };
  const boundary = boundaries[type];
  if (!boundary) return [{ section, code: "PDF_LAYOUT_UNVERIFIED", status: "unverified" }];
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const start = lines.indexOf(boundary[0]), end = lines.findIndex((line, i) => i > start && line === boundary[1]);
  if (start < 0 || end <= start) return [{ section, code: "PDF_LAYOUT_UNVERIFIED", status: "unverified" }];
  const body = lines.slice(start + 1, end);
  if (type === "financial-analysis" && !body.includes("Budget & Pacing")) return [{ section, code: "PDF_LAYOUT_UNVERIFIED", status: "unverified" }];
  const values: Record<string, [number | null, number, string]> = {
    USERS: [expected.totals.users, 0, ""], SESSIONS: [expected.totals.sessions, 0, ""], CONVERSIONS: [expected.totals.conversions, 8, ""],
    REVENUE: [expected.revenue, 2, "money"], SPEND: [expected.spend, 2, "money"], PROFIT: [expected.profit, 2, "money"],
    ROAS: [expected.roas, type === "financial-analysis" ? 2 : 1, "x"], ROI: [expected.roi, 1, "%"],
    "COST PER ACQUISITION": [expected.cpa, 2, "money"], "CONVERSION RATE": [expected.cvr, 1, "%"],
    "ENGAGEMENT RATE": [expected.engagementRate === null ? null : expected.engagementRate * 100, 1, "%"],
    "CAMPAIGN BUDGET": [expected.pacing.budget, 2, "money"], "BUDGET USED": [expected.pacing.periodSpend, 2, "money"],
    "REMAINING BUDGET": [expected.pacing.remaining, 2, "money"], "BUDGET UTILIZATION": [expected.pacing.utilization, 1, "%"],
    "DAILY BURN RATE": [expected.pacing.burn, 2, "money"], "TARGET DAILY SPEND": [expected.pacing.target, 2, "money"],
  };
  const keys = type === "performance-summary" ? ["USERS", "SESSIONS", "CONVERSIONS", "REVENUE", "SPEND"]
    : type === "financial-analysis" ? ["SPEND", "REVENUE", "PROFIT", "ROAS", "ROI", "COST PER ACQUISITION", "CONVERSION RATE", "CAMPAIGN BUDGET", "BUDGET USED", "REMAINING BUDGET", "BUDGET UTILIZATION", "DAILY BURN RATE", "TARGET DAILY SPEND"]
    : type === "executive-summary" ? ["USERS", "SESSIONS", "CONVERSIONS", "REVENUE", "SPEND", "CONVERSION RATE", "ROAS", "ROI"]
    : ["REVENUE", "SPEND", "ROAS", "ROI", "CONVERSIONS", "COST PER ACQUISITION", "SESSIONS", "USERS", "CONVERSION RATE", "ENGAGEMENT RATE"];
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: expected.scope.currency }).formatToParts(1).find(part => part.type === "currency")?.value;
  for (const key of keys) {
    const [wanted, decimals, unit] = values[key];
    const label = type === "performance-summary" || (type === "financial-analysis" && ["REVENUE", "SPEND"].includes(key)) ? `TOTAL ${key}` : key;
    const indexes = body.flatMap((line, i) => line === label ? [i] : []), raw = indexes.length === 1 ? body[indexes[0] + 1] : undefined;
    // Trend deliberately omits unavailable cards; the other three show them.
    if (wanted === null && (type === "trend-analysis" && indexes.length === 0 || raw?.startsWith("Unavailable"))) {
      checks.push({ section, code: key.replaceAll(" ", "_") + "_UNAVAILABLE", status: "passed" }); continue;
    }
    let numberText = raw;
    if (unit === "money") {
      const negative = raw?.startsWith("-"), unsigned = negative ? raw?.slice(1) : raw;
      numberText = currency && unsigned?.startsWith(currency) ? `${negative ? "-" : ""}${unsigned.slice(currency.length).trim()}` : undefined;
    }
    else if (unit) numberText = raw?.endsWith(unit) ? raw.slice(0, -unit.length) : undefined;
    const actual = numberText && /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(numberText) ? Number(numberText.replaceAll(",", "")) : null;
    if (wanted === null && actual !== null || wanted !== null && raw?.startsWith("Unavailable")) {
      checks.push({ section, code: key.replaceAll(" ", "_") + "_AVAILABILITY", status: "difference" }); continue;
    }
    checks.push(compareNumber(section, key.replaceAll(" ", "_"), wanted, actual, { decimals: key === "CONVERSIONS" ? undefined : decimals, conversions: key === "CONVERSIONS", operations: 10000 }));
  }
  if (type === "financial-analysis") {
    const pct = expected.pacing.percentage;
    const status = pct === null ? "Unavailable" : pct > 115 ? `${(pct - 100).toFixed(1)}% Over` : pct < 85 ? `${(100 - pct).toFixed(1)}% Under` : "On Track";
    for (const [label, wanted] of [["PACING STATUS", status], ["BUDGET PERIOD START", dateIsValid(snapshot.campaign.pacingStartDate) ? snapshot.campaign.pacingStartDate : "Unavailable"],
      ["BUDGET PERIOD END", dateIsValid(snapshot.campaign.pacingEndDate) ? snapshot.campaign.pacingEndDate : "Unavailable"]]) {
      const indexes = body.flatMap((line, i) => line === label ? [i] : []);
      checks.push({ section, code: label.replaceAll(" ", "_"), status: indexes.length !== 1 ? "unverified" : body[indexes[0] + 1] === wanted ? "passed" : "difference" });
    }
  }
  return checks;
}

// Checks newly generated bytes, with the exact current input snapshot available.
// Unlike historical artifacts, these have a provable conversion/window basis.
export function checkGeneratedReportText(snapshot: LiveNumberSnapshot, text: string, type: string, now = new Date()): NumberCheck[] {
  const expected = expectedOutputNumbers(snapshot, now), checks: NumberCheck[] = [], section = `Generated ${type} PDF`;
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const card = (label: string, wanted: unknown, decimals: number, unit: "number" | "money" | "rate" | "ratio", subset = lines) => {
    const indexes = subset.flatMap((line, index) => line === label ? [index] : []), raw = indexes.length === 1 ? subset[indexes[0] + 1] : undefined;
    const unavailable = raw !== undefined && /^(?:Unavailable|Not available|N\/A|—|–)$/.test(raw);
    if (wanted === null && unavailable) { checks.push({ section, code: label.replace(/[^A-Z0-9]/g, "_") + "_UNAVAILABLE", status: "passed" }); return; }
    const pattern = unit === "money" ? new RegExp(`^${expected.scope.currency} (-?[\\d,]+(?:\\.\\d+)?)$`)
      : new RegExp(`^(-?[\\d,]+(?:\\.\\d+)?)${unit === "rate" ? "%" : unit === "ratio" ? "x" : ""}$`);
    const match = raw?.match(pattern);
    checks.push(compareNumber(section, label.replace(/[^A-Z0-9]/g, "_"), wanted, match ? numberOrNull(match[1].replaceAll(",", "")) : null,
      { decimals: label === "CONVERSIONS" ? undefined : decimals, conversions: label === "CONVERSIONS", operations: 10000 }));
  };
  if (type === "overview" || type === "custom") {
    const summaryStart = lines.indexOf("Summary"), nextSection = lines.findIndex((line, index) => index > summaryStart && ["Revenue & Financial", "Campaign Breakdown", "Landing Pages", "Conversion Events", "Key Performance Indicators", "Performance Benchmarks", "Ad Comparison", "Executive Summary"].includes(line));
    const subset = summaryStart < 0 ? [] : lines.slice(summaryStart + 1, nextSection < 0 ? lines.length : nextSection);
    for (const metric of ["sessions", "users", "conversions"]) card(metric.toUpperCase(), expected.totals[metric], metric === "conversions" ? 8 : 0, "number", subset);
    card("ENGAGEMENT RATE", expected.engagementRate === null ? null : expected.engagementRate * 100, 1, "rate", subset);
    card("CONV. RATE", expected.cvr, 1, "rate", subset);
    card("TOTAL REVENUE", expected.revenue, 2, "money"); card("TOTAL SPEND", expected.spend, 2, "money");
    card("PROFIT", expected.profit, 2, "money"); card("ROAS", expected.roas, 2, "ratio");
    card("ROI", expected.roi, 1, "rate"); card("CPA", expected.cpa, 2, "money");
  } else if (type === "insights") {
    const start = lines.indexOf("Executive Summary"), end = lines.indexOf("Data Summary", start);
    // Titles are bounded to avoid mistaking another table's Revenue for the card.
    const subset = start >= 0 && end > start ? lines.slice(start, end) : lines;
    card("REVENUE", expected.revenue, 2, "money", subset); card("SPEND", expected.spend, 2, "money", subset);
    card("PROFIT", expected.profit, 2, "money", subset); card("ROAS", expected.roas, 2, "ratio", subset); card("ROI", expected.roi, 1, "rate", subset);
  } else if (type === "ads") {
    const totalLines = lines.filter(line => /^TOTAL [A-Z]{3} /.test(line));
    const match = totalLines.length === 1 ? totalLines[0].match(new RegExp(`^TOTAL ${expected.scope.currency} (-?[\\d,]+(?:\\.\\d+)?)$`)) : null;
    checks.push(compareNumber(section, "SOURCE_REVENUE_TOTAL", expected.revenue, match ? Number(match[1].replaceAll(",", "")) : null, { decimals: 2 }));
  }
  if (["kpis", "benchmarks", "custom"].includes(type)) for (const kind of type === "custom" ? ["kpis", "benchmarks"] : [type]) {
    const items = (snapshot.rows[kind] || []).filter(row => row.platformType === "google_analytics");
    // This is propagation to actual PDF bytes. Independent current-value and
    // target calculations are checked separately by checkStoredNumbers.
    const flat = lines.join(" ");
    for (const item of items) {
      const name = String(item.name || item.metric).replace(/\s+/g, " ").trim();
      const current = String(item.currentValue || "0"), target = String((kind === "kpis" ? item.targetValue : item.benchmarkValue) || "0");
      const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?:^|\\s)${escaped(name)}\\s+${escaped(current)}\\s+${escaped(target)}(?:\\s|$)`);
      checks.push({ section, code: `${kind.toUpperCase()}_CURRENT_TARGET`, subject: monitorHash(String(item.id)), status: pattern.test(flat) ? "passed" : "unverified" });
    }
    if (!items.length) checks.push({ section, code: `${kind.toUpperCase()}_NO_CONFIGURED_ROWS`, status: "passed" });
  }
  return checks.length ? checks : [{ section, code: "PDF_OUTPUT_UNVERIFIED", status: "unverified" }];
}

export function checkReportDetailText(snapshot: LiveNumberSnapshot, text: string, type: string, now = new Date(), comparisonMetric = "sessions"): NumberCheck[] {
  const expected = expectedOutputNumbers(snapshot, now), section = `Generated ${type} PDF details`, checks: NumberCheck[] = [];
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const numeric = "(-?(?:\\d+|\\d{1,3}(?:,\\d{3})+)(?:\\.\\d+)?|Unavailable)";
  const row = (code: string, name: string, values: Array<[unknown, number | undefined, string?]>, subset = lines) => {
    const pattern = new RegExp(`^${escape(name)} ${values.map(([, , unit]) => `${unit === "money" ? escape(expected.scope.currency) + " " : ""}${numeric}${unit === "%" ? "%" : ""}`).join(" ")}$`);
    const found = subset.map(line => line.match(pattern)).filter(Boolean), subject = monitorHash(name);
    if (found.length !== 1) { checks.push({ section, code: code + "_ROW_UNVERIFIED", subject, status: "unverified" }); return; }
    values.forEach(([wanted, decimals], index) => {
      const raw = found[0]![index + 1], actual = raw === "Unavailable" ? null : numberOrNull(raw.replaceAll(",", ""));
      if (wanted === null && actual === null) checks.push({ section, code: `${code}_${index}_UNAVAILABLE`, subject, status: "passed" });
      else if (wanted === null || actual === null) checks.push({ section, code: `${code}_${index}_AVAILABILITY`, subject, status: "difference" });
      else {
        const conversion = ["CONVERSION_EVENT", "SUMMARY_conversions", "WEBSITE_CONVERSIONS"].includes(code) && index === 0
          || ["LANDING_PAGE", "CAMPAIGN_BREAKDOWN", "ALL_CAMPAIGNS", "INSIGHTS_TREND"].includes(code) && index === 2;
        checks.push(compareNumber(section, `${code}_${index}`, wanted, actual, { decimals: conversion ? undefined : decimals, conversions: conversion, operations: 10000, subject }));
      }
    });
  };
  if (type === "overview" || type === "ads") {
    for (const event of (type === "overview" ? expected.scope.publication.conversionEvents?.rows || [] : []).slice(0, 25)) row("CONVERSION_EVENT", String(event.eventName),
      [[event.conversions, 8], [event.eventCount, 0], [event.users, 0]]);
    for (const page of (type === "overview" ? expected.scope.publication.landingPages?.rows || [] : []).slice(0, 20)) row("LANDING_PAGE", `${page.landingPage} ${page.source || "(not set)"}/${page.medium || "(not set)"}`,
      [[page.sessions, 0], [page.users, 0], [page.conversions, 8], [page.sessions > 0 ? page.conversions / page.sessions * 100 : 0, 1, "%"]]);
    const campaigns = new Map<string, { sessions: number; users: number; conversions: number; revenue: number; weightedRate: number }>();
    for (const item of expected.scope.publication.campaignBreakdown?.rows || []) {
      const current = campaigns.get(item.campaign) || { sessions: 0, users: 0, conversions: 0, revenue: 0, weightedRate: 0 };
      for (const key of ["sessions", "users", "conversions", "revenue"] as const) current[key] += Number(item[key]);
      current.weightedRate += item.sessions > 0 ? item.sessions * Number(item.sessionKeyEventRate) : 0;
      campaigns.set(item.campaign, current);
    }
    const nativeCampaigns = Array.from(campaigns.entries()).map(([name, item]) => ({ name, ...item }));
    let allocationVerified = true;
    const normalize = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const names = Array.from(campaigns.keys());
    if (new Set(names.map(normalize)).size !== names.length) allocationVerified = false;
    for (const source of expected.revenueSources) {
      const original = snapshot.rows.revenueSources.find(item => item.id === source.id);
      let cfg: any; try { cfg = parseMonitorMapping(original?.mappingConfig); } catch { allocationVerified = false; continue; }
      const mappings = Array.isArray(cfg.campaignMappings) ? cfg.campaignMappings : [];
      const values = Array.isArray(cfg.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
      if (!mappings.length || !values.length) continue; // Unallocated revenue stays outside campaign rows.
      if (source.value === null || Math.abs(values.reduce((sum: number, item: any) => sum + Number(item.revenue), 0) - source.value) >= 0.005) { allocationVerified = false; continue; }
      const seen = new Set<string>();
      for (const item of values) {
        const key = normalize(item.campaignValue), matches = mappings.filter((mapping: any) => normalize(mapping.crmValue) === key);
        if (seen.has(key) || matches.length !== 1 || numberOrNull(item.revenue) === null) { allocationVerified = false; continue; }
        seen.add(key);
        const name = names.find(name => normalize(name) === normalize(matches[0].linkedinCampaignName || matches[0].linkedinCampaignUrn));
        if (name) campaigns.get(name)!.revenue += Number(item.revenue);
      }
    }
    // Independent largest-remainder cent allocation preserves the exact selected
    // campaign total without substituting the broader Revenue card total.
    const amounts = names.map(name => ({ name, exact: campaigns.get(name)!.revenue * 100, cents: Math.floor(campaigns.get(name)!.revenue * 100) }));
    const targetCents = Math.round(Number((amounts.reduce((sum, item) => sum + item.exact, 0) / 100).toFixed(2)) * 100);
    const remaining = targetCents - amounts.reduce((sum, item) => sum + item.cents, 0);
    const removesCent = targetCents < names.reduce((sum, name) => sum + Math.round(Number(campaigns.get(name)!.revenue.toFixed(2)) * 100), 0);
    const ranked = [...amounts].sort((a, b) => (b.exact - b.cents) - (a.exact - a.cents)
      || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) * (removesCent ? -1 : 1));
    if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > ranked.length) allocationVerified = false;
    else for (let i = 0; i < remaining; i++) ranked[i].cents++;
    if (!allocationVerified) checks.push({ section, code: "CAMPAIGN_REVENUE_ALLOCATION_UNVERIFIED", status: "unverified" });
    else if (type === "overview") for (const amount of amounts) {
      const item = campaigns.get(amount.name)!;
      row("CAMPAIGN_BREAKDOWN", amount.name, [[item.sessions, 0], [item.users, 0], [item.conversions, 8],
        [item.sessions > 0 ? item.weightedRate / item.sessions * 100 : 0, 1, "%"], [amount.cents / 100, 2, "money"]]);
    }
    else {
      const rows = amounts.map(amount => ({ ...campaigns.get(amount.name)!, name: amount.name, revenue: amount.cents / 100 }))
        .sort((a, b) => b.sessions - a.sessions);
      const rate = (item: typeof rows[number]) => item.sessions > 0 ? item.weightedRate / item.sessions * 100 : 0;
      const integer = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
      const checkText = (code: string, title: string, detail: string) => {
        const index = lines.indexOf(title);
        const actual = lines.slice(index + 1, index + 4).join(" ");
        checks.push({ section, code, status: index < 0 ? "unverified" : actual.startsWith(detail) && (actual.length === detail.length || actual[detail.length] === " ") ? "passed" : "difference" });
      };
      checkText("CAMPAIGN_COUNT", "CAMPAIGNS COMPARED", String(rows.length));
      const labels: Record<string, string> = { sessions: "Sessions", users: "Users", conversions: "Conversions", revenue: "Revenue", conversionRate: "Conversion Rate" };
      const metric = labels[comparisonMetric] ? comparisonMetric : "sessions";
      const metricValue = (item: typeof rows[number]) => metric === "conversionRate" ? rate(item) : Number(item[metric as "sessions"]);
      const formatValue = (value: number) => metric === "revenue" ? `${expected.scope.currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : metric === "conversionRate" ? `${Math.round(value * 10) / 10}%` : metric === "conversions" ? value.toLocaleString("en-US", { maximumSignificantDigits: 21 }) : integer(value);
      const totalLabel = metric === "revenue" ? "CAMPAIGN BREAKDOWN REVENUE" : metric === "conversionRate" ? "OVERALL CONVERSION RATE" : `TOTAL ${labels[metric].toUpperCase()}`;
      const totalSessions = rows.reduce((sum, item) => sum + item.sessions, 0);
      const metricTotal = metric === "conversionRate" ? totalSessions > 0 ? rows.reduce((sum, item) => sum + item.weightedRate, 0) / totalSessions * 100 : 0
        : rows.reduce((sum, item) => sum + metricValue(item), 0);
      checkText(metric === "sessions" ? "CAMPAIGN_SESSIONS" : "CAMPAIGN_SELECTED_TOTAL", totalLabel, formatValue(metricTotal));
      if (rows.length > 1) {
        const best = [...rows].filter(item => item.conversions > 0).sort((a, b) => b.conversions - a.conversions || a.name.localeCompare(b.name))[0];
        const efficient = [...rows].filter(item => item.sessions > 0 && rate(item) > 0).sort((a, b) => rate(b) - rate(a))[0];
        const floor = Math.max(25, Math.ceil(Math.max(...rows.map(item => item.sessions)) * 0.1));
        const positive = rows.filter(item => item.sessions > 0), enough = positive.filter(item => item.sessions >= floor);
        const attentionRows = (enough.length ? enough : positive).sort((a, b) => rate(a) - rate(b));
        let attention = attentionRows[0];
        if (attention?.name === best?.name) attention = attentionRows.find(item => item.name !== best?.name && rate(item) === rate(attention)) || attention;
        const leader = (item: typeof rows[number], detail: string) => `${item.name.slice(0, 22)} ${detail.slice(0, 32)}`;
        checkText("KEY_EVENT_LEADER", "MOST KEY EVENTS", best ? leader(best, `${best.conversions.toLocaleString("en-US", { maximumSignificantDigits: 21 })} Key Events - ${rate(best).toFixed(2)}% CR`) : "No key event leader No key events recorded");
        checkText("RATE_LEADER", "HIGHEST CONVERSION RATE", efficient ? leader(efficient, `${rate(efficient).toFixed(2)}% CR - ${expected.scope.currency} ${efficient.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} revenue`) : "No rate leader No conversions recorded");
        if (attention) checkText("ATTENTION_CAMPAIGN", "NEEDS ATTENTION", leader(attention, `${rate(attention).toFixed(2)}% CR - ${integer(attention.sessions)} sessions`));
      }
      const start = lines.indexOf(`Top Campaigns by ${labels[metric]}`), end = lines.indexOf(totalLabel, start);
      const chart = lines.slice(start + 1, end).join(" ");
      for (const item of [...rows].sort((a, b) => metricValue(b) - metricValue(a) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.name.localeCompare(b.name, "en", { sensitivity: "variant" })).slice(0, 10)) {
        checks.push({ section, code: "CAMPAIGN_CHART_VALUE", subject: monitorHash(item.name), status: start < 0 || end <= start ? "unverified" : new RegExp(`(?:^| )${escape(formatValue(metricValue(item)) + " " + item.name)}(?: |$)`).test(chart) ? "passed" : "difference" });
      }
      if (lines.includes("All Campaigns")) for (const [index, item] of Array.from(nativeCampaigns.entries())) row("ALL_CAMPAIGNS", `${index + 1} ${item.name.slice(0, 28)}`,
        [[item.sessions, 0], [item.users, 0], [item.conversions, 8], [item.revenue, 2, "money"], [item.sessions > 0 ? item.conversions / item.sessions * 100 : 0, 2, "%"]]);
    }
  }
  if (["overview", "ads", "financial-analysis"].includes(type)) {
    const symbolic = type === "financial-analysis";
    const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: expected.scope.currency }).formatToParts(1).find(part => part.type === "currency")?.value;
    for (const [kind, sources] of [["revenue", expected.revenueSources], ["spend", expected.spendSources]] as const) {
      const header = symbolic ? kind === "revenue" ? "Revenue Sources" : "Spend Sources" : type === "ads" ? "Revenue Breakdown" : kind === "revenue" ? "Revenue Sources" : "Spend Sources";
      // Overview and Comparison render revenue contributors only. The Financial
      // Analysis template also renders spend contributors; zero Comparison rows
      // are intentionally omitted by its existing template.
      if (!symbolic && kind === "spend") continue;
      const start = lines.indexOf(header);
      for (const source of sources) {
        if (type === "ads" && source.value === 0) continue;
        const original = snapshot.rows[kind + "Sources"].find(item => item.id === source.id);
        const label = String(original?.displayName || original?.sourceType || "");
        const candidates = start < 0 ? [] : lines.slice(start + 1).filter(line => line.startsWith(label + " "));
        // Intl currency output puts the negative sign before the symbol.
        const pattern = new RegExp(`^${escape(label)} ${symbolic ? "(-?)" + escape(currency || "") : escape(expected.scope.currency) + " "}${numeric}$`);
        const matches = candidates.map(line => line.match(pattern)).filter(Boolean);
        const actual = matches.length === 1 ? numberOrNull((symbolic ? matches[0]![1] + matches[0]![2] : matches[0]![1]).replaceAll(",", "")) : null;
        checks.push(compareNumber(section, kind.toUpperCase() + "_SOURCE_AMOUNT", source.value, actual, { decimals: 2, subject: monitorHash(source.id) }));
      }
    }
  }
  if (type === "insights") {
    const start = lines.indexOf("Data Summary"), end = lines.indexOf("What to investigate next", start);
    const summary = lines.slice(start + 1, end).map(line => line.replace(/ (Current GA4 total|Sum of daily users|Total across revenue sources)$/, ""));
    for (const metric of ["sessions", "users", "conversions"]) row("SUMMARY_" + metric, metric[0].toUpperCase() + metric.slice(1), [[expected.totals[metric], metric === "conversions" ? 8 : 0]], summary);
    row("SUMMARY_revenue", "Revenue", [[expected.revenue, 2, "money"]], summary);
    const tableStart = lines.indexOf("DATE SESSIONS REVENUE CONVERSIONS"), tableEnd = lines.indexOf("Data Summary", tableStart);
    // Insights deliberately starts at campaign creation, then shows the last
    // fourteen recorded days. Imported history may predate campaign creation.
    const created = new Date(snapshot.campaign.createdAt), validCreated = Number.isFinite(created.getTime());
    const historyStart = validCreated ? new Intl.DateTimeFormat("en-CA", { timeZone: expected.scope.reportingTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(created) : "";
    const first = new Date(Date.parse(expected.scope.endDate) - 59 * 86400000).toISOString().slice(0, 10);
    const days = (snapshot.rows.ga4DailyMetrics || []).filter(day => day.propertyId === expected.scope.connection.propertyId && historyStart && day.date >= historyStart && day.date >= first && day.date <= expected.scope.endDate)
      .sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    const rows = lines.slice(tableStart + 1, tableEnd).filter(line => /^\d{4}-\d{2}-\d{2} /.test(line));
    checks.push({ section, code: "INSIGHTS_TREND_DATES", status: !validCreated || tableStart < 0 || tableEnd <= tableStart ? "unverified"
      : JSON.stringify(rows.map(line => line.slice(0, 10))) === JSON.stringify(days.map(day => day.date).sort()) ? "passed" : "difference" });
    for (const day of days) row("INSIGHTS_TREND", day.date, [[day.sessions, 0], [numberOrNull(day.revenue), 2, "money"], [day.conversions, 8]], rows);
  }
  if (type === "trend-analysis") {
    const start = lines.indexOf("Website Engagement & Conversion Summary"), end = lines.indexOf("Executive Recommendations", start);
    const subset = lines.slice(start + 1, end);
    for (const [label, wanted, decimals, unit] of [["SESSIONS", expected.totals.sessions, 0, ""], ["ENGAGED SESSIONS", expected.totals.engagedSessions, 0, ""],
      ["CONVERSIONS", expected.totals.conversions, 8, ""], ["ENGAGEMENT RATE", expected.engagementRate === null ? null : expected.engagementRate * 100, 1, "%"],
      ["CONVERSIONS PER 100 SESSIONS", expected.cvr, 1, ""]] as const) {
      const index = subset.indexOf(label);
      row("WEBSITE_" + label.replaceAll(" ", "_"), label, [[wanted, decimals, unit]], index < 0 ? [] : [label + " " + subset[index + 1]]);
    }
  }
  if (type === "performance-summary" || type === "executive-summary") {
    const targets = expectedTargetNumbers(snapshot, now), flat = lines.join(" ");
    if (targets.some(target => !target.verified)) checks.push({ section, code: "TARGET_COVERAGE_UNVERIFIED", status: "unverified" });
    else if (type === "performance-summary") {
      const onTrack = targets.filter(target => target.kind === "kpis" ? target.band !== "below" : target.benchmarkStatus === "on_track").length;
      const score = targets.length ? Math.round(onTrack / targets.length * 100) : null;
      const wanted = score === null ? "No GA4 KPI or Benchmark targets configured." : `${score}% - ${score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Needs Attention" : "Critical"}; ${onTrack} of ${targets.length} configured metrics on track.`;
      const begin = flat.indexOf("Campaign Health"), end = flat.indexOf("Top Priority Action", begin);
      checks.push({ section, code: "CAMPAIGN_HEALTH", status: begin < 0 || end <= begin ? "unverified" : flat.slice(begin, end).includes(wanted) ? "passed" : "difference" });
    } else {
      for (const kind of ["kpis", "benchmarks"]) {
        const configured = targets.filter(target => target.kind === kind);
        const exceptions = configured.filter(target => kind === "kpis" ? target.band === "below" : target.benchmarkStatus !== "on_track");
        const title = kind === "kpis" ? "KPI" : "Benchmark";
        const start = flat.indexOf(title + " Exceptions"), end = flat.indexOf(kind === "kpis" ? "Benchmark Exceptions" : "Risk Assessment", start + 1);
        const body = start >= 0 && end > start ? flat.slice(start, end) : "";
        if (!exceptions.length) {
          const wanted = configured.length ? `No ${title} Exceptions:` : `${title} Status Unavailable:`;
          checks.push({ section, code: `${title.toUpperCase()}_EXCEPTION_STATE`, status: !body ? "unverified" : body.includes(wanted) ? "passed" : "difference" });
        }
        for (const item of exceptions) {
          const label = kind === "kpis" ? "Below Target" : item.benchmarkStatus === "behind" ? "Behind" : "Needs Attention";
          checks.push({ section, code: `${title.toUpperCase()}_EXCEPTION_STATUS`, subject: monitorHash(String(item.row.id)),
            status: new RegExp(escape(String(item.row.name)) + "\\s+" + label + "\\b").test(body) ? "passed" : "difference" });
          const format = (value: number) => {
            const unit = item.row.unit;
            if (["revenue", "cpa"].includes(item.identity!)) return new Intl.NumberFormat("en-US", { style: "currency", currency: expected.scope.currency, maximumFractionDigits: 2 }).format(value);
            if (unit === "%") return value.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%";
            if (unit === "ratio" || unit === "x") return value.toFixed(2) + "x";
            if (unit === "count" || item.identity === "conversions") return value.toLocaleString("en-US", { maximumSignificantDigits: 21 });
            if (["roi", "conversion_rate", "engagement_rate"].includes(item.identity!)) return value.toFixed(1) + "%";
            if (item.identity === "roas") return value.toFixed(1) + "x";
            return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
          };
          const progress = kind === "benchmarks" ? item.attainment! : (item.identity === "cpa" ? item.current! > 0 ? item.target! / item.current! : 1 : item.current! / item.target!) * 100;
          const detail = `${kind === "kpis" ? "Current" : "Yours"} ${format(item.current!)}; ${kind === "kpis" ? "Target" : "Benchmark"} ${format(item.target!)}; ${progress.toFixed(1)}%`;
          checks.push({ section, code: `${title.toUpperCase()}_EXCEPTION_VALUES`, subject: monitorHash(String(item.row.id)),
            status: new RegExp(escape(String(item.row.name)) + "\\s+" + label + "\\s+" + escape(detail)).test(body) ? "passed" : "difference" });
        }
      }
    }
  }
  return checks;
}

export function checkConfiguredReportText(snapshot: LiveNumberSnapshot, text: string, report: any, now = new Date()): NumberCheck[] {
  const section = "Configured report PDF", subject = monitorHash(String(report.id)), checks: NumberCheck[] = [];
  if (report.campaignId !== snapshot.campaign.id) return [{ section, subject, code: "REPORT_CAMPAIGN_MISMATCH", status: "difference" }];
  let cfg: any;
  try { cfg = report.configuration == null ? {} : parseMonitorMapping(report.configuration); }
  catch { return [{ section, subject, code: "REPORT_CONFIGURATION_UNVERIFIED", status: "unverified" }]; }
  const add = (values: NumberCheck[]) => checks.push(...values.map(value => ({ ...value, section, subject })));
  if (report.platformType === "campaign_deepdive") {
    const selected = Array.isArray(cfg.selectedSections) ? cfg.selectedSections : [];
    if (!selected.length || selected.some((key: string) => !diagnosticTypes.some(type => key === `${type}:overview`)))
      checks.push({ section, subject, code: "DIAGNOSTIC_SELECTION_UNVERIFIED", status: "unverified" });
    for (const type of diagnosticTypes.filter(type => selected.includes(`${type}:overview`))) {
      add(checkDiagnosticReportText(snapshot, text, type, now)); add(checkReportDetailText(snapshot, text, type, now));
    }
    return checks;
  }
  if (report.platformType !== "google_analytics" || !["overview", "kpis", "benchmarks", "ads", "insights", "custom"].includes(report.reportType))
    return [{ section, subject, code: "REPORT_TYPE_UNVERIFIED", status: "unverified" }];
  if (report.reportType !== "custom") {
    add(checkGeneratedReportText(snapshot, text, report.reportType, now));
    add(checkReportDetailText(snapshot, text, report.reportType, now, cfg.adComparisonMetric || "sessions"));
    return checks;
  }
  const selected = (group: string, key: string) => cfg.sections?.[group] === true && cfg.subsections?.[group]?.[key] === true;
  const known: Record<string, string[]> = { overview: ["summary", "revenue", "spend", "performance", "campaignBreakdown", "landingPages", "conversionEvents"],
    kpis: ["items"], benchmarks: ["items"], ads: ["summary", "topCampaigns", "allCampaigns", "bestWorst", "revenueBreakdown"], insights: ["summaryCards", "trends", "dataSummary", "actions"] };
  if (Object.entries(cfg.sections || {}).some(([key, value]) => !(key in known) || typeof value !== "boolean")
    || Object.entries(cfg.subsections || {}).some(([group, value]) => !known[group] || !value || typeof value !== "object"
      || Object.entries(value).some(([key, enabled]) => !known[group].includes(key) || typeof enabled !== "boolean")))
    checks.push({ section, subject, code: "REPORT_SELECTION_SCHEMA_UNVERIFIED", status: "unverified" });
  const filtered: LiveNumberSnapshot = { ...snapshot, rows: { ...snapshot.rows } };
  for (const [kind, field] of [["kpis", "selectedKpiIds"], ["benchmarks", "selectedBenchmarkIds"]]) {
    const ids = Array.isArray(cfg[field]) ? cfg[field].map(String) : [];
    filtered.rows[kind] = (snapshot.rows[kind] || []).filter(row => row.platformType === "google_analytics" && ids.includes(row.id));
    if (selected(kind, "items") && (new Set(ids).size !== ids.length || filtered.rows[kind].length !== ids.length))
      checks.push({ section, subject, code: `${kind}_SELECTION_UNVERIFIED`, status: "unverified" });
  }
  const groups: Record<string, string[]> = { summary: ["SESSIONS", "USERS", "CONVERSIONS", "ENGAGEMENT_RATE", "CONV__RATE"],
    revenue: ["TOTAL_REVENUE"], spend: ["TOTAL_SPEND"], performance: ["PROFIT", "ROAS", "ROI", "CPA"] };
  const enabledCodes = Object.entries(groups).filter(([key]) => selected("overview", key)).flatMap(([, codes]) => codes);
  add(checkGeneratedReportText(filtered, text, "custom", now).filter(check => enabledCodes.some(code => check.code === code || check.code === code + "_UNAVAILABLE")
    || selected("kpis", "items") && check.code.startsWith("KPIS_") || selected("benchmarks", "items") && check.code.startsWith("BENCHMARKS_")));
  const detailGroups: Record<string, string[]> = { campaignBreakdown: ["CAMPAIGN_BREAKDOWN", "CAMPAIGN_REVENUE_ALLOCATION"],
    landingPages: ["LANDING_PAGE"], conversionEvents: ["CONVERSION_EVENT"], revenue: ["REVENUE_SOURCE_AMOUNT"] };
  const detailCodes = Object.entries(detailGroups).filter(([key]) => selected("overview", key)).flatMap(([, codes]) => codes);
  add(checkReportDetailText(filtered, text, "overview", now).filter(check => detailCodes.some(code => check.code.startsWith(code))));
  if (cfg.sections?.insights) {
    if (selected("insights", "summaryCards")) add(checkGeneratedReportText(filtered, text, "insights", now));
    add(checkReportDetailText(filtered, text, "insights", now).filter(check => selected("insights", "dataSummary") && check.code.startsWith("SUMMARY_")
      || selected("insights", "trends") && check.code.startsWith("INSIGHTS_TREND")));
    if (selected("insights", "actions")) checks.push({ section, subject, code: "INSIGHT_NARRATIVE_UNVERIFIED", status: "unverified" });
  }
  if (cfg.sections?.ads) {
    if (selected("ads", "revenueBreakdown")) add(checkGeneratedReportText(filtered, text, "ads", now));
    const selectedMetric = cfg.adComparisonMetric || "sessions";
    add(checkReportDetailText(filtered, text, "ads", now, selectedMetric).filter(check => selected("ads", "revenueBreakdown") && check.code === "REVENUE_SOURCE_AMOUNT"
      || (selected("ads", "topCampaigns") || selected("ads", "summary")) && ["CAMPAIGN_COUNT", "CAMPAIGN_SESSIONS", "CAMPAIGN_SELECTED_TOTAL", "CAMPAIGN_CHART_VALUE"].includes(check.code)
      || selected("ads", "bestWorst") && ["KEY_EVENT_LEADER", "RATE_LEADER", "ATTENTION_CAMPAIGN"].includes(check.code)
      || selected("ads", "allCampaigns") && check.code.startsWith("ALL_CAMPAIGNS")));
    if (selected("ads", "allCampaigns") && !text.split(/\r?\n/).some(line => line.trim() === "All Campaigns"))
      checks.push({ section, subject, code: "CAMPAIGN_DETAIL_TABLE_MISSING", status: "difference" });
    if (!["sessions", "users", "conversions", "revenue", "conversionRate"].includes(selectedMetric)) checks.push({ section, subject, code: "COMPARISON_SELECTION_UNVERIFIED", status: "unverified" });
  }
  if (!checks.length) checks.push({ section, subject, code: "REPORT_SELECTION_UNVERIFIED", status: "unverified" });
  return checks;
}

export async function checkGeneratedReportNumbers(snapshot: LiveNumberSnapshot, blockedOperations: () => number = () => 0, diagnosticSources?: any[]): Promise<NumberCheck[]> {
  const { buildGA4ScheduledPdfAttachment } = await import("./ga4-scheduled-report-pdf");
  const { buildPdfAttachmentForReport } = await import("./report-scheduler");
  const { scope } = expectedOutputNumbers(snapshot), checks: NumberCheck[] = [];
  const generated = new Map<string, string>();
  for (const reportType of ["overview", "kpis", "benchmarks", "ads", "insights", "custom", ...diagnosticTypes]) {
    if (diagnosticTypes.includes(reportType) && (!Array.isArray(diagnosticSources)
      || !diagnosticSources.some(source => source.id === "ga4" && source.connected)
      || diagnosticSources.some(source => source.connected && source.id !== "ga4" && source.category !== "financial"))) {
      checks.push({ section: `Generated ${reportType} PDF`, code: "DIAGNOSTIC_SOURCE_SCOPE_UNVERIFIED", status: "unverified" }); continue;
    }
    const blockedBefore = blockedOperations();
    try {
      const report = { campaignId: snapshot.campaign.id, platformType: "google_analytics", reportType, name: "Monitoring validation",
        configuration: reportType === "custom" ? { sections: { overview: true, kpis: true, benchmarks: true },
          subsections: { overview: { summary: true, revenue: true, spend: true, performance: true }, kpis: { items: true }, benchmarks: { items: true } },
          selectedKpiIds: (snapshot.rows.kpis || []).map(row => row.id), selectedBenchmarkIds: (snapshot.rows.benchmarks || []).map(row => row.id) } : undefined };
      // Build in memory only: no snapshot creation, report library save or email.
      const diagnostic = diagnosticTypes.includes(reportType);
      if (diagnostic) Object.assign(report, { platformType: "campaign_deepdive", reportType: "custom", configuration: { reportType, selectedSections: [`${reportType}:overview`] } });
      const buffer = await (diagnostic ? buildPdfAttachmentForReport : buildGA4ScheduledPdfAttachment)({ report, campaignName: snapshot.campaign.name, windowStart: scope.startDate, windowEnd: scope.endDate });
      if (!buffer || buffer.length > 5_000_000) throw new Error();
      const parser = new PDFParse({ data: buffer });
      try {
        const info = await parser.getInfo(); if (info.total > 100) throw new Error();
        const result = await parser.getText(); if (result.text.length > 1_000_000) throw new Error();
        generated.set(JSON.stringify([report.platformType, report.reportType, report.configuration || {}]), result.text);
        checks.push(...(diagnostic ? checkDiagnosticReportText : checkGeneratedReportText)(snapshot, result.text, reportType));
        checks.push(...checkReportDetailText(snapshot, result.text, reportType));
      } finally { await parser.destroy(); }
    } catch { checks.push({ section: `Generated ${reportType} PDF`, code: "PDF_GENERATION_UNVERIFIED", status: "unverified" }); }
    if (blockedOperations() !== blockedBefore) checks.push({ section: `Generated ${reportType} PDF`, code: "PDF_AUXILIARY_READ_OR_WRITE_BLOCKED", status: "unverified" });
  }
  // Validate actual saved selections as well as the standard templates. Reuse
  // identical generated artifacts; never save, schedule or send these PDFs.
  for (const [index, report] of Array.from((snapshot.rows.linkedinReports || []).entries())) {
    const subject = monitorHash(String(report.id)), section = "Configured report PDF", blockedBefore = blockedOperations();
    if (index >= 20) { checks.push({ section, subject, code: "REPORT_RUN_LIMIT_UNVERIFIED", status: "unverified" }); continue; }
    if (report.campaignId !== snapshot.campaign.id || !["google_analytics", "campaign_deepdive"].includes(report.platformType)) {
      checks.push({ section, subject, code: "REPORT_SCOPE_UNVERIFIED", status: "unverified" }); continue;
    }
    if (report.platformType === "campaign_deepdive" && (!Array.isArray(diagnosticSources) || !diagnosticSources.some(source => source.id === "ga4" && source.connected)
      || diagnosticSources.some(source => source.connected && source.id !== "ga4" && source.category !== "financial"))) {
      checks.push({ section, subject, code: "DIAGNOSTIC_SOURCE_SCOPE_UNVERIFIED", status: "unverified" }); continue;
    }
    try {
      const configuration = report.configuration == null ? {} : parseMonitorMapping(report.configuration);
      const key = JSON.stringify([report.platformType, report.reportType, configuration]);
      let text = generated.get(key);
      if (text === undefined) {
        const buffer = await (report.platformType === "campaign_deepdive" ? buildPdfAttachmentForReport : buildGA4ScheduledPdfAttachment)({
          report: { ...report, configuration }, campaignName: snapshot.campaign.name, windowStart: scope.startDate, windowEnd: scope.endDate });
        if (!buffer || buffer.length > 5_000_000) throw new Error();
        const parser = new PDFParse({ data: buffer });
        try {
          if ((await parser.getInfo()).total > 100) throw new Error();
          text = (await parser.getText()).text; if (text.length > 1_000_000) throw new Error();
        } finally { await parser.destroy(); }
        generated.set(key, text);
      }
      checks.push(...checkConfiguredReportText(snapshot, text, report));
    } catch { checks.push({ section, subject, code: "CONFIGURED_PDF_UNVERIFIED", status: "unverified" }); }
    if (blockedOperations() !== blockedBefore) checks.push({ section, subject, code: "PDF_AUXILIARY_READ_OR_WRITE_BLOCKED", status: "unverified" });
  }
  return checks;
}

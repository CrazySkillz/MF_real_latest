// @ts-nocheck
/**
 * NOTE: Extracted from `pages/linkedin-analytics.tsx` to reduce editor memory pressure (Cursor OOM).
 * These helpers are intentionally loosely typed while the LinkedIn analytics page refactor is in progress.
 */

export function getLinkedInPdfGenerators(ctx: any) {
  const {
    sessionData,
    aggregated,
    metrics,
    linkedInDailyResp,
    linkedInInsights,
    reportForm,
    customReportConfig,
    kpisData,
    benchmarksData,
    adsData,
    formatCurrency,
    formatNumber,
    formatPercentage,
    getMetricDisplay,
    getLiveCurrentForKpi,
  } = ctx || {};

  // PDF Helper: Add header
  const addPDFHeader = (doc: any, title: string, subtitle: string) => {
    const { metrics } = (sessionData as any) || {};

    // Get unique campaign names from metrics
    const campaignNames = metrics
      ? Array.from(new Set(metrics.map((m: any) => m.campaignName))).join(", ")
      : "N/A";

    // LinkedIn brand color header
    doc.setFillColor(0, 119, 181); // LinkedIn blue
    doc.rect(0, 0, 210, 40, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, "bold");
    doc.text(title, 20, 20);

    // Subtitle
    doc.setFontSize(12);
    doc.setFont(undefined, "normal");
    doc.text(subtitle, 20, 30);

    // Report info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 50);
    doc.text(`Campaign: ${campaignNames}`, 20, 57);
  };

  // PDF Helper: Add section
  const addPDFSection = (doc: any, title: string, y: number, color: number[] = [66, 139, 202]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(15, y, 180, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(title, 20, y + 7);
    return y + 15;
  };

  // PDF Helper: Append Insights section (used by Standard + Custom reports)
  const appendInsightsPDF = (
    doc: any,
    y: number,
    opts: { executiveFinancials?: boolean; trends?: boolean; whatChanged?: boolean }
  ) => {
    const showExec = !!opts.executiveFinancials;
    const showTrends = !!opts.trends;
    const showWhatChanged = !!opts.whatChanged;

    if (!showExec && !showTrends && !showWhatChanged) return y;

    if (y > 235) {
      doc.addPage();
      y = 20;
    }

    y = addPDFSection(doc, "Insights", y, [16, 185, 129]);
    doc.setTextColor(50, 50, 50);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);

    const aggregatedAny = (sessionData as any)?.aggregated || (aggregated as any) || {};
    const hasRevenueTracking = Number((aggregatedAny as any)?.hasRevenueTracking || 0) === 1;
    const conversionValue = Number((aggregatedAny as any)?.conversionValue || (aggregatedAny as any)?.conversionvalue || 0) || 0;
    const hasConversionValue = Number.isFinite(conversionValue) && conversionValue > 0;

    const safeAddLine = (text: string) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(text, 20, y);
      y += 6;
    };

    if (showExec) {
      doc.setFont(undefined, "bold");
      safeAddLine("Executive financials");
      doc.setFont(undefined, "normal");

      const spend = Number((aggregatedAny as any)?.totalSpend ?? (aggregatedAny as any)?.spend ?? 0) || 0;
      const totalRevenue = Number((aggregatedAny as any)?.totalRevenue ?? (aggregatedAny as any)?.revenue ?? 0) || 0;
      const roas = Number((aggregatedAny as any)?.roas ?? 0) || 0;
      const roi = Number((aggregatedAny as any)?.roi ?? 0) || 0;

      safeAddLine(`Spend: ${formatCurrency(spend)}`);
      safeAddLine(`Total Revenue: ${hasRevenueTracking ? formatCurrency(totalRevenue) : "Not connected"}`);
      safeAddLine(`ROAS: ${hasRevenueTracking ? `${roas.toFixed(2)}x` : "Not connected"}`);
      safeAddLine(`ROI: ${hasRevenueTracking ? formatPercentage(roi) : "Not connected"}`);

      if (hasRevenueTracking && !hasConversionValue) {
        safeAddLine(
          "Note: Revenue is connected, but conversion value is missing/0; ad-level revenue attribution may be unavailable."
        );
      }

      y += 4;
    }

    if (showTrends) {
      doc.setFont(undefined, "bold");
      safeAddLine("Trends");
      doc.setFont(undefined, "normal");

      const rows = Array.isArray((linkedInDailyResp as any)?.data) ? (linkedInDailyResp as any).data : [];
      const byDate = rows
        .map((r: any) => {
          const date = String(r?.date || "").trim();
          const impressions = Number(r?.impressions || 0) || 0;
          const clicks = Number(r?.clicks || 0) || 0;
          const conversions = Number(r?.conversions || 0) || 0;
          const spend = Number(r?.spend || 0) || 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
          const revenue = hasRevenueTracking && hasConversionValue ? conversions * conversionValue : 0;
          const roas = spend > 0 ? revenue / spend : 0;
          return { date, impressions, clicks, conversions, spend, ctr, cvr, revenue, roas };
        })
        .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
        .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

      if (byDate.length < 14) {
        safeAddLine("Not enough daily history yet for week-over-week comparisons (need at least 14 days).");
      } else {
        const last7 = byDate.slice(-7);
        const prior7 = byDate.slice(-14, -7);
        const sum = (arr: any[], k: string) => arr.reduce((acc, r) => acc + (Number(r?.[k] || 0) || 0), 0);

        const lastSpend = sum(last7, "spend");
        const priorSpend = sum(prior7, "spend");
        const lastConv = sum(last7, "conversions");
        const priorConv = sum(prior7, "conversions");

        const deltaPct = (cur: number, prev: number) => (prev !== 0 ? ((cur - prev) / prev) * 100 : null);
        const fmtDelta = (v: number | null) => (v === null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

        safeAddLine(
          `Spend (last 7d vs prior 7d): ${formatCurrency(lastSpend)} vs ${formatCurrency(priorSpend)} (${fmtDelta(
            deltaPct(lastSpend, priorSpend)
          )})`
        );
        safeAddLine(
          `Conversions (last 7d vs prior 7d): ${formatNumber(lastConv)} vs ${formatNumber(priorConv)} (${fmtDelta(
            deltaPct(lastConv, priorConv)
          )})`
        );

        if (hasRevenueTracking && hasConversionValue) {
          const lastRev = sum(last7, "revenue");
          const priorRev = sum(prior7, "revenue");
          safeAddLine(
            `Revenue (last 7d vs prior 7d): ${formatCurrency(lastRev)} vs ${formatCurrency(priorRev)} (${fmtDelta(
              deltaPct(lastRev, priorRev)
            )})`
          );
        }
      }

      y += 4;
    }

    if (showWhatChanged) {
      doc.setFont(undefined, "bold");
      safeAddLine("What changed, what to do next");
      doc.setFont(undefined, "normal");

      const items = Array.isArray(linkedInInsights) ? linkedInInsights : [];
      if (items.length === 0) {
        safeAddLine("No insights available.");
      } else {
        items.slice(0, 6).forEach((i: any, idx: number) => {
          const title = String(i?.title || `Insight ${idx + 1}`).trim();
          const rec = String(i?.recommendation || "").trim();
          safeAddLine(`- ${title}`);
          if (rec) safeAddLine(`  Next: ${rec}`);
        });
      }
    }

    return y + 2;
  };

  const addCampaignBreakdownPDF = (doc: any, y: number, aggregated: any, opts?: { selectedCampaignUrns?: string[] }) => {
    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) return y;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    y = addPDFSection(doc, "Campaign Breakdown", y, [54, 162, 235]);

    // Build campaign groups similar to the UI breakdown
    const campaigns = Object.values(
      (metrics as any[]).reduce((acc: any, metric: any) => {
        if (!acc[metric.campaignUrn]) {
          acc[metric.campaignUrn] = {
            campaignUrn: metric.campaignUrn,
            name: metric.campaignName,
            status: metric.campaignStatus,
            metrics: {},
          };
        }
        acc[metric.campaignUrn].metrics[metric.metricKey] = parseFloat(metric.metricValue);
        return acc;
      }, {})
    ) as any[];

    const conversionValue = Number((aggregated as any)?.conversionValue || (aggregated as any)?.conversionvalue || 0);
    const hasRevenue = (aggregated as any)?.hasRevenueTracking === 1 && Number.isFinite(conversionValue) && conversionValue > 0;

    const selectedUrns = Array.isArray(opts?.selectedCampaignUrns) ? opts!.selectedCampaignUrns : null;
    const visibleCampaigns =
      selectedUrns && selectedUrns.length > 0
        ? campaigns.filter((c: any) =>
            selectedUrns.includes(String((c as any)?.campaignUrn || (c as any)?.urn || (c as any)?.id || ""))
          )
        : campaigns;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 6, 170, 8, "F");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    doc.text("Campaign", 22, y);
    doc.text("Spend", 92, y);
    doc.text("Impr", 112, y);
    doc.text("Clicks", 130, y);
    doc.text("Conv", 147, y);
    doc.text("Leads", 160, y);
    doc.text("CTR", 175, y);

    y += 10;

    doc.setFont(undefined, "normal");
    doc.setTextColor(50, 50, 50);

    visibleCampaigns.forEach((c: any) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const impressions = Number(c?.metrics?.impressions || 0);
      const clicks = Number(c?.metrics?.clicks || 0);
      const spend = Number(c?.metrics?.spend || 0);
      const conversions = Number(c?.metrics?.conversions || 0);
      const leads = Number(c?.metrics?.leads || 0);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;
      const revenue = hasRevenue ? conversions * conversionValue : 0;
      const profit = hasRevenue ? revenue - spend : 0;
      const roi = hasRevenue && spend > 0 ? (profit / spend) * 100 : 0;
      const roas = hasRevenue && spend > 0 ? revenue / spend : 0;

      const name = String(c?.name || "Campaign");
      const nameShort = name.length > 30 ? `${name.slice(0, 29)}…` : name;

      doc.setFontSize(8);
      doc.text(nameShort, 22, y);
      doc.text(formatCurrency(spend), 92, y);
      doc.text(formatNumber(impressions), 112, y);
      doc.text(formatNumber(clicks), 130, y);
      doc.text(formatNumber(conversions), 147, y);
      doc.text(formatNumber(leads), 160, y);
      doc.text(`${ctr.toFixed(2)}%`, 175, y);

      doc.setTextColor(110, 110, 110);
      doc.setFontSize(7);
      const baseLine = `CPC ${formatCurrency(cpc)}  CPA ${formatCurrency(cpa)}  CVR ${cvr.toFixed(2)}%`;
      const revLine = hasRevenue ? `  Rev ${formatCurrency(revenue)}  ROAS ${roas.toFixed(2)}x  ROI ${roi.toFixed(1)}%` : "";
      doc.text(`${baseLine}${revLine}`, 22, y + 4);
      doc.setTextColor(50, 50, 50);

      y += 12;
    });

    return y + 6;
  };

  // Generate Overview PDF
  const generateOverviewPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const { aggregated } = (sessionData as any) || {};

    const title = String(opts?.title || reportForm?.name || "LinkedIn Report");
    const configuration = opts?.configuration || reportForm?.configuration || {};
    addPDFHeader(doc, title, "LinkedIn Metrics");

    let y = 70;

    if (!aggregated || Object.keys(aggregated).length === 0) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text("No metrics data available", 20, y);
      return;
    }

    // Separate core, derived, and revenue metrics
    const derivedMetrics = ["ctr", "cpc", "cpm", "cvr", "cpa", "cpl", "er"];
    const revenueMetrics = ["totalrevenue", "roas", "roi", "profit", "profitmargin", "revenueperlead"];
    const excludeMetrics = ["hasrevenuetracking", "conversionvalue", "revenue", "performanceindicators"];
    const coreMetricsData: any[] = [];
    const derivedMetricsData: any[] = [];
    const revenueMetricsData: any[] = [];

    Object.entries(aggregated).forEach(([key, value]: [string, any]) => {
      // Normalize the key - be careful to preserve revenue metric names
      let metricKey = key.toLowerCase();

      // Only strip 'total' prefix if it's not 'totalrevenue' (a revenue metric)
      if (metricKey.startsWith("total") && metricKey !== "totalrevenue") {
        metricKey = metricKey.substring(5); // Remove 'total' prefix
      }

      // Strip 'avg' prefix
      if (metricKey.startsWith("avg")) {
        metricKey = metricKey.substring(3); // Remove 'avg' prefix
      }

      // Skip excluded metrics
      if (excludeMetrics.includes(metricKey)) return;

      const { label, format } = getMetricDisplay(metricKey, value);
      const formattedValue = format(value);

      if (revenueMetrics.includes(metricKey)) {
        revenueMetricsData.push({ label, value: formattedValue });
      } else if (derivedMetrics.includes(metricKey)) {
        derivedMetricsData.push({ label, value: formattedValue });
      } else {
        coreMetricsData.push({ label, value: formattedValue });
      }
    });

    // Core Metrics Section
    if (coreMetricsData.length > 0) {
      y = addPDFSection(doc, "Core Metrics", y, [52, 168, 83]);
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont(undefined, "normal");

      coreMetricsData.forEach((metric: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, "bold");
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, "normal");
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });

      y += 10;
    }

    // Derived Metrics Section
    if (derivedMetricsData.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      y = addPDFSection(doc, "Derived Metrics", y, [255, 159, 64]);
      doc.setTextColor(50, 50, 50);

      derivedMetricsData.forEach((metric: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, "bold");
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, "normal");
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });

      y += 10;
    }

    // Revenue Metrics Section - Only if revenue tracking is enabled
    if (revenueMetricsData.length > 0 && aggregated.hasRevenueTracking === 1) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      y = addPDFSection(doc, "Revenue Metrics", y, [16, 185, 129]);
      doc.setTextColor(50, 50, 50);

      revenueMetricsData.forEach((metric: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, "bold");
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, "normal");
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });
    }

    // Campaign Breakdown (per-campaign metrics)
    y = addCampaignBreakdownPDF(doc, y, aggregated);

    // Optional Insights section (Standard Templates)
    if ((configuration as any)?.includeInsights) {
      y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("PerformanceCore Analytics Platform", 105, 285, { align: "center" });
  };

  // Generate KPIs PDF
  const generateKPIsPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm?.name || "LinkedIn Report");
    const configuration = opts?.configuration || reportForm?.configuration || {};
    addPDFHeader(doc, title, "LinkedIn Metrics");

    let y = 70;
    y = addPDFSection(doc, "Key Performance Indicators", y, [156, 39, 176]);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);

    // Helper function to calculate performance level
    const getKPIPerformanceLevel = (kpi: any): { level: string; color: number[] } => {
      const current = getLiveCurrentForKpi(kpi);
      const target = parseFloat(kpi.targetValue || "0");

      if (target === 0) return { level: "N/A", color: [150, 150, 150] };

      const ratio = current / target;
      const lowerIsBetter = ["cpc", "cpm", "cpa", "cpl", "spend"].some(
        (m: string) => kpi.metric?.toLowerCase().includes(m) || kpi.name?.toLowerCase().includes(m)
      );

      if (lowerIsBetter) {
        if (ratio <= 0.8) return { level: "Excellent", color: [52, 168, 83] };
        if (ratio <= 1.0) return { level: "Good", color: [66, 139, 202] };
        if (ratio <= 1.2) return { level: "Fair", color: [255, 193, 7] };
        return { level: "Poor", color: [220, 53, 69] };
      } else {
        if (ratio >= 1.2) return { level: "Excellent", color: [52, 168, 83] };
        if (ratio >= 1.0) return { level: "Good", color: [66, 139, 202] };
        if (ratio >= 0.8) return { level: "Fair", color: [255, 193, 7] };
        return { level: "Poor", color: [220, 53, 69] };
      }
    };

    if (kpisData && Array.isArray(kpisData) && kpisData.length > 0) {
      kpisData.forEach((kpi: any) => {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }

        // KPI Box - increased height for performance indicator
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 60, 3, 3, "S");

        // KPI name
        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        doc.text(kpi.name, 25, y + 2);

        // Current and Target values
        doc.setFont(undefined, "normal");
        doc.setFontSize(10);
        const liveCurrent = getLiveCurrentForKpi(kpi);
        doc.text(`Current: ${formatNumber(liveCurrent || 0)}${kpi.unit || ""}`, 25, y + 18);
        doc.text(`Target: ${formatNumber(parseFloat(kpi.targetValue) || 0)}${kpi.unit || ""}`, 100, y + 18);

        // Progress bar
        const current = liveCurrent || 0;
        const target = parseFloat(kpi.targetValue) || 100;
        const progress = Math.min((current / target) * 100, 100);

        doc.setFillColor(230, 230, 230);
        doc.roundedRect(25, y + 32, 160, 8, 2, 2, "F");

        if (progress > 0) {
          const fillColor = progress >= 100 ? [52, 168, 83] : [66, 139, 202];
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          const barWidth = (160 * progress) / 100;
          doc.roundedRect(25, y + 32, barWidth, 8, 2, 2, "F");
        }

        // Performance Level Assessment
        const perf = getKPIPerformanceLevel(kpi);
        doc.setFillColor(perf.color[0], perf.color[1], perf.color[2]);
        doc.roundedRect(25, y + 44, 40, 7, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont(undefined, "bold");
        doc.text(perf.level, 45, y + 49, { align: "center" });
        doc.setFont(undefined, "normal");
        doc.setTextColor(50, 50, 50);

        y += 70;
      });
    } else {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text("No KPIs created yet.", 20, y);
    }

    if ((configuration as any)?.includeInsights) {
      y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("PerformanceCore Analytics Platform", 105, 285, { align: "center" });
  };

  // Generate Benchmarks PDF
  const generateBenchmarksPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm?.name || "LinkedIn Report");
    const configuration = opts?.configuration || reportForm?.configuration || {};
    addPDFHeader(doc, title, "LinkedIn Metrics");

    let y = 70;
    y = addPDFSection(doc, "Performance Benchmarks", y, [255, 99, 132]);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);

    if (benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0) {
      benchmarksData.forEach((benchmark: any) => {
        if (y > 220) {
          doc.addPage();
          y = 20;
        }

        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 45, 3, 3, "S");

        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        doc.text(benchmark.name, 25, y + 2);

        doc.setFont(undefined, "normal");
        doc.setFontSize(10);
        doc.text(`Metric: ${benchmark.metric || ""}`, 25, y + 18);

        const liveCurrent = Number(benchmark.currentValue || 0) || 0;
        const benchVal = Number(benchmark.benchmarkValue || 0) || 0;
        doc.text(`Performance: ${formatNumber(liveCurrent)}${benchmark.unit || ""}`, 25, y + 28);
        doc.text(`Benchmark: ${formatNumber(benchVal)}${benchmark.unit || ""}`, 100, y + 28);

        y += 55;
      });
    } else {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text("No benchmarks created yet.", 20, y);
    }

    if ((configuration as any)?.includeInsights) {
      y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("PerformanceCore Analytics Platform", 105, 285, { align: "center" });
  };

  // Generate Ad Comparison PDF (Standard Template)
  const generateAdComparisonPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm?.name || "LinkedIn Report");
    addPDFHeader(doc, title, "LinkedIn Metrics");

    let y = 70;
    if (adsData && Array.isArray(adsData) && adsData.length > 0) {
      y = addPDFSection(doc, "Ad Performance Comparison", y, [54, 162, 235]);
      y = addPDFSection(doc, "Ad Performance Summary", y, [54, 162, 235]);
      y = addPDFSection(doc, "Individual Ad Performance", y, [54, 162, 235]);
    } else {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text("No ad data available.", 20, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("PerformanceCore Analytics Platform", 105, 285, { align: "center" });
  };

  // Generate Insights PDF (Standard Template)
  const generateInsightsPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm?.name || "Insights Report");
    addPDFHeader(doc, title, "LinkedIn Metrics");

    let y = 70;
    y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("PerformanceCore Analytics Platform", 105, 285, { align: "center" });
  };

  // Back-compat: saved report downloads call this for custom reports.
  const generateCustomReportPDF = (doc: any, cfg: any) => {
    generateCustomPDF(doc, cfg);
  };

  // Generate Custom PDF based on user selections
  const generateCustomPDF = (doc: any, customCfg: any = customReportConfig) => {
    // Shadow to keep existing references in this function working.
    const customReportConfig = customCfg as any;
    const { aggregated } = (sessionData as any) || {};

    addPDFHeader(doc, reportForm?.name, "LinkedIn Metrics");

    let y = 70;

    // Helper function to find the correct aggregated key
    const findAggregatedKey = (metricKey: string): any => {
      if (!aggregated) return null;

      const keyMappings: Record<string, string> = {
        totalrevenue: "totalRevenue",
        profitmargin: "profitMargin",
        revenueperlead: "revenuePerLead",
        videoviews: "videoViews",
      };

      const mappedKey = keyMappings[metricKey.toLowerCase()];
      if (mappedKey && aggregated[mappedKey] !== undefined) return aggregated[mappedKey];

      if (aggregated[metricKey] !== undefined) return aggregated[metricKey];

      const totalKey = "total" + metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
      if (aggregated[totalKey] !== undefined) return aggregated[totalKey];

      const avgKey = "avg" + metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
      if (aggregated[avgKey] !== undefined) return aggregated[avgKey];

      const lowerKey = metricKey.toLowerCase();
      if (aggregated[lowerKey] !== undefined) return aggregated[lowerKey];

      const capitalKey = metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
      if (aggregated[capitalKey] !== undefined) return aggregated[capitalKey];

      return null;
    };

    const getMetricLabel = (key: string): string => {
      const labels: Record<string, string> = {
        impressions: "Impressions",
        clicks: "Clicks",
        spend: "Spend",
        conversions: "Conversions",
        reach: "Reach",
        engagements: "Engagements",
        videoviews: "Video Views",
        leads: "Leads",
        totalrevenue: "Total Revenue",
        revenue: "Total Revenue",
        ctr: "CTR",
        cpc: "CPC",
        cpm: "CPM",
        cvr: "Conversion Rate",
        cpa: "CPA",
        cpl: "CPL",
        er: "Engagement Rate",
        roi: "ROI",
        roas: "ROAS",
        profit: "Profit",
        profitmargin: "Profit Margin",
        revenueperlead: "Revenue Per Lead",
      };
      return labels[key.toLowerCase()] || key;
    };

    const formatMetricValue = (key: string, value: any): string => {
      if (!value && value !== 0) return "N/A";

      const percentageMetrics = ["ctr", "cvr", "er", "roi", "profitmargin"];
      const currencyMetrics = [
        "spend",
        "cpc",
        "cpm",
        "cpa",
        "cpl",
        "revenue",
        "totalrevenue",
        "profit",
        "revenueperlead",
      ];

      if (percentageMetrics.includes(key.toLowerCase())) {
        return `${parseFloat(value).toFixed(2)}%`;
      } else if (currencyMetrics.includes(key.toLowerCase())) {
        return `$${parseFloat(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (key.toLowerCase() === "roas") {
        return `${parseFloat(value).toFixed(2)}x`;
      } else {
        return parseFloat(value).toLocaleString();
      }
    };

    const hasMetrics = customReportConfig.coreMetrics.length > 0 || customReportConfig.derivedMetrics.length > 0;
    if (hasMetrics) {
      y = addPDFSection(doc, "Overview", y, [54, 162, 235]);

      if (customReportConfig.coreMetrics.length > 0) {
        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text("Core Metrics", 20, y);
        y += 10;

        doc.setFont(undefined, "normal");
        doc.setFontSize(10);
        customReportConfig.coreMetrics.forEach((metric: any) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }

          const label = getMetricLabel(metric);
          const value = findAggregatedKey(metric);
          const formattedValue = formatMetricValue(metric, value !== null ? value : 0);
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        y += 5;
      }
    }

    const cbdCampaigns = Array.isArray((customReportConfig as any).campaignBreakdownCampaigns)
      ? (customReportConfig as any).campaignBreakdownCampaigns
      : [];
    const showCbd = cbdCampaigns.length > 0 || !!(customReportConfig as any).includeCampaignBreakdown;
    if (showCbd) {
      y = addCampaignBreakdownPDF(doc, y, aggregated, {
        selectedCampaignUrns: cbdCampaigns.length > 0 ? cbdCampaigns : undefined,
      });
    }

    const insightKeys = Array.isArray((customReportConfig as any).insightsSections)
      ? (customReportConfig as any).insightsSections
      : [];
    if (insightKeys.length > 0) {
      y = appendInsightsPDF(doc, y, {
        executiveFinancials: insightKeys.includes("executive_financials"),
        trends: insightKeys.includes("trends"),
        whatChanged: insightKeys.includes("what_changed"),
      });
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("PerformanceCore Analytics Platform", 105, 285, { align: "center" });
  };

  return {
    addPDFHeader,
    addPDFSection,
    appendInsightsPDF,
    addCampaignBreakdownPDF,
    generateOverviewPDF,
    generateKPIsPDF,
    generateBenchmarksPDF,
    generateAdComparisonPDF,
    generateInsightsPDF,
    generateCustomReportPDF,
    generateCustomPDF,
  };
}


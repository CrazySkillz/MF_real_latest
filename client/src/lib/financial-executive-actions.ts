export type FinancialExecutiveAction = {
  title: string;
  body: string;
  tone: "success" | "warning" | "info";
};

export type FinancialPacingStatus = "unavailable" | "ahead" | "behind" | "on-track";

export type FinancialBudgetPeriodSpendMetric = {
  available: boolean;
  value: number;
  unavailableReasons: string[];
};

const FINANCIAL_PACING_DAY_MS = 24 * 60 * 60 * 1000;

const parseFinancialPacingDateOrdinal = (value?: string | null): number | null => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.getTime()
    : null;
};

const getFinancialReportingDateOrdinal = (now: Date, reportingTimeZone?: string | null): number => {
  const buildOrdinal = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
  };
  try {
    return buildOrdinal(String(reportingTimeZone || "UTC").trim() || "UTC");
  } catch {
    return buildOrdinal("UTC");
  }
};

export function resolveFinancialPacingCalendar(input: {
  startDate?: string | null;
  endDate?: string | null;
  reportingTimeZone?: string | null;
  now?: Date;
}) {
  const startDateOrdinal = parseFinancialPacingDateOrdinal(input.startDate);
  const endDateOrdinal = parseFinancialPacingDateOrdinal(input.endDate);
  const todayDateOrdinal = getFinancialReportingDateOrdinal(input.now || new Date(), input.reportingTimeZone);
  const hasDateRange = startDateOrdinal !== null && endDateOrdinal !== null && endDateOrdinal >= startDateOrdinal;
  const elapsedEndDateOrdinal = endDateOrdinal !== null && todayDateOrdinal > endDateOrdinal
    ? endDateOrdinal
    : todayDateOrdinal;
  const elapsedDays = startDateOrdinal !== null && elapsedEndDateOrdinal >= startDateOrdinal
    ? Math.floor((elapsedEndDateOrdinal - startDateOrdinal) / FINANCIAL_PACING_DAY_MS) + 1
    : 0;
  const totalDays = hasDateRange
    ? Math.floor((endDateOrdinal - startDateOrdinal) / FINANCIAL_PACING_DAY_MS) + 1
    : 0;

  return {
    startDateOrdinal,
    endDateOrdinal,
    todayDateOrdinal,
    hasStartDate: startDateOrdinal !== null,
    hasEndDate: endDateOrdinal !== null,
    hasDateRange,
    elapsedDays,
    totalDays,
  };
}

export function resolveFinancialBudgetPeriodSpend(input: {
  contract?: any;
  campaignId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string | null;
}): FinancialBudgetPeriodSpendMetric {
  const contract = input.contract;
  const spend = contract?.spend;
  const value = Number(spend?.value);
  const compatible = contract?.version === "budget_pacing_v1"
    && String(contract?.campaignId || "") === String(input.campaignId || "")
    && String(contract?.periodStartDate || "") === String(input.startDate || "")
    && String(contract?.periodEndDate || "") === String(input.endDate || "")
    && String(contract?.currency || "").trim().toUpperCase() === String(input.currency || "").trim().toUpperCase();
  if (compatible && spend?.available === true && spend?.value !== null && spend?.value !== undefined && spend?.value !== "" && Number.isFinite(value) && value >= 0) {
    return { available: true, value, unavailableReasons: [] };
  }
  const reasons = Array.isArray(spend?.unavailableReasons)
    ? spend.unavailableReasons.map(String).filter(Boolean)
    : [];
  return {
    available: false,
    value: 0,
    unavailableReasons: reasons.length > 0 ? reasons : ["Budget-period Spend is unavailable"],
  };
}

export function resolveFinancialPaidMediaEfficiencyCompatibility(sources: any[]) {
  const paidSources = (Array.isArray(sources) ? sources : []).filter((source) =>
    source?.connected === true && (source?.category === "paid_media" || source?.id === "custom_integration"),
  );
  const sourcesWithMetric = (metricName: string) => paidSources.filter((source) =>
    Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName),
  );
  const sourceKey = (source: any) => String(source?.id || source?.label || "").trim();
  const sameSourceSet = (left: any[], right: any[]) => {
    const leftKeys = new Set(left.map(sourceKey).filter(Boolean));
    const rightKeys = new Set(right.map(sourceKey).filter(Boolean));
    return leftKeys.size > 0 && leftKeys.size === rightKeys.size
      && Array.from(leftKeys).every((key) => rightKeys.has(key));
  };
  const sourceLabels = (matchingSources: any[]) => matchingSources
    .map((source) => String(source?.label || source?.id || "").trim())
    .filter(Boolean);
  const spendSources = sourcesWithMetric("spend");
  const clickSources = sourcesWithMetric("clicks");
  const impressionSources = sourcesWithMetric("impressions");

  return {
    cpc: {
      compatible: spendSources.length > 0 && spendSources.every((source) => source.includedMetrics.includes("clicks")),
      sourceLabels: sourceLabels(spendSources),
    },
    cpm: {
      compatible: spendSources.length > 0 && spendSources.every((source) => source.includedMetrics.includes("impressions")),
      sourceLabels: sourceLabels(spendSources),
    },
    ctr: {
      compatible: sameSourceSet(clickSources, impressionSources),
      sourceLabels: sourceLabels(clickSources),
    },
  };
}

export function buildFinancialBudgetAction(input: {
  hasCampaignBudget: boolean;
  spendAvailable: boolean;
  spendUnavailableText: string;
  isOverBudget: boolean;
  overBudgetAmountText: string;
  hasValidDateRange: boolean;
  elapsedDays: number;
  pacingStatus: FinancialPacingStatus;
  pacingVarianceText: string;
  budgetUtilizationText: string;
  remainingBudgetText: string;
}): FinancialExecutiveAction {
  if (!input.hasCampaignBudget || !input.spendAvailable) {
    return {
      title: "Budget pacing unavailable",
      body: !input.hasCampaignBudget
        ? "Set the campaign budget and budget period dates to assess utilization and pacing."
        : input.spendUnavailableText,
      tone: "info",
    };
  }
  if (input.isOverBudget) {
    return {
      title: "Campaign is over budget",
      body: `Spend exceeds the configured budget by ${input.overBudgetAmountText}. Review further commitments before adding spend.`,
      tone: "warning",
    };
  }
  if (!input.hasValidDateRange) {
    return {
      title: "Budget pacing unavailable",
      body: "Set valid budget period start and end dates to compare actual daily spend with the target.",
      tone: "info",
    };
  }
  if (input.elapsedDays === 0 || input.pacingStatus === "unavailable") {
    return {
      title: "Budget period has not started",
      body: "Pacing will be assessed once the configured budget period begins.",
      tone: "info",
    };
  }
  if (input.pacingStatus === "behind") {
    return {
      title: "Budget is pacing below target",
      body: `Daily spend is ${input.pacingVarianceText} below target after ${input.elapsedDays} elapsed budget-period ${input.elapsedDays === 1 ? "day" : "days"}. ${input.budgetUtilizationText} of the configured budget has been used. Review delivery before changing allocation.`,
      tone: "warning",
    };
  }
  if (input.pacingStatus === "ahead") {
    return {
      title: "Budget is pacing above target",
      body: `Daily spend is ${input.pacingVarianceText} above target after ${input.elapsedDays} elapsed budget-period ${input.elapsedDays === 1 ? "day" : "days"}. Review remaining budget and commitments before adding spend.`,
      tone: "warning",
    };
  }
  return {
    title: "Budget pacing is on track",
    body: `Daily spend is within the configured pacing range after ${input.elapsedDays} elapsed budget-period ${input.elapsedDays === 1 ? "day" : "days"}. ${input.remainingBudgetText} remains available.`,
    tone: "success",
  };
}

export function buildFinancialAllocationAction(input: {
  hasCampaignToDateWindow: boolean;
  sources: Array<{ label: string; roas: number | null }>;
  spendInputs: Array<{ label: string; spend: number }>;
  authoritativeSpend: number | null;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}): FinancialExecutiveAction {
  if (!input.hasCampaignToDateWindow) {
    return {
      title: "Allocation window unavailable",
      body: "Source allocation is withheld until the campaign aggregate has a certified cumulative reporting window.",
      tone: "info",
    };
  }
  const spendInputs = input.spendInputs.filter((source) => Number.isFinite(source.spend) && source.spend > 0);
  if (spendInputs.length > 0) {
    const sourceSpendTotal = spendInputs.reduce((total, source) => total + source.spend, 0);
    if (input.authoritativeSpend === null || Math.abs(sourceSpendTotal - input.authoritativeSpend) > 0.01) {
      return {
        title: "Spend source allocation unavailable",
        body: "The spend-source breakdown does not reconcile to authoritative Total Spend, so no allocation guidance is shown.",
        tone: "info",
      };
    }
    const largestSource = spendInputs.reduce((largest, source) => source.spend > largest.spend ? source : largest);
    const largestShare = sourceSpendTotal > 0 ? (largestSource.spend / sourceSpendTotal) * 100 : 0;
    return {
      title: "Review spend source mix",
      body: `${largestSource.label} is the largest of ${spendInputs.length} spend ${spendInputs.length === 1 ? "source" : "sources"} at ${input.formatCurrency(largestSource.spend)} (${input.formatPercentage(largestShare)}). Compare the recorded source mix with the intended campaign plan before changing allocation.`,
      tone: "info",
    };
  }
  if (input.sources.length === 0) {
    return {
      title: "Allocation is not available",
      body: "No main connected source provides spend. Financial input records still support connected-source totals, but they are not standalone platforms for reallocation.",
      tone: "info",
    };
  }
  if (input.sources.length === 1) {
    return {
      title: "No reallocation decision yet",
      body: `${input.sources[0].label} is the only spend-capable main source. Reallocation requires at least two comparable sources.`,
      tone: "info",
    };
  }
  if (input.sources.filter((source) => source.roas !== null).length < 2) {
    return {
      title: "Source return comparison unavailable",
      body: "Multiple main sources provide spend, but at least two also need compatible source-level revenue before returns can be compared.",
      tone: "info",
    };
  }
  return {
    title: "Review source allocation",
    body: "Multiple spend-capable sources are available. Compare spend share and compatible ROAS before reallocating budget.",
    tone: "info",
  };
}

export type FinancialExecutiveAction = {
  title: string;
  body: string;
  tone: "success" | "warning" | "info";
};

export type FinancialPacingStatus = "unavailable" | "ahead" | "behind" | "on-track";

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
      body: "No main connected source provides campaign-to-date spend. Financial input records still support campaign totals, but they are not standalone platforms for reallocation.",
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

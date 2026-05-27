/**
 * Helper functions for the Executive Summary endpoint.
 * Extracted to keep routes-oauth.ts manageable.
 */

/** Safely parse a numeric value, returning 0 for any non-finite result. */
export function parseNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

/** Convert a PostgreSQL interval string (HH:MM:SS or MM:SS) to seconds. */
export function parseInterval(interval: any): number {
  if (!interval) return 0;
  const str = String(interval);
  const parts = str.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  } else if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return parseNum(str);
}

/**
 * Conservative diminishing-returns model for ad-spend scaling.
 * Returns adjusted ROAS plus best/worst-case bounds.
 */
export function calculateDiminishingReturns(
  currentSpend: number,
  additionalSpend: number,
  currentRoas: number,
) {
  const spendIncreasePct = (additionalSpend / currentSpend) * 100;
  let efficiencyLoss = 0;

  if (spendIncreasePct <= 25) efficiencyLoss = 0.05;
  else if (spendIncreasePct <= 50) efficiencyLoss = 0.15;
  else if (spendIncreasePct <= 100) efficiencyLoss = 0.25;
  else efficiencyLoss = 0.35;

  const adjustedRoas = currentRoas * (1 - efficiencyLoss);
  return {
    adjustedRoas,
    efficiencyLoss: efficiencyLoss * 100,
    bestCase: currentRoas * (1 - efficiencyLoss * 0.5),
    worstCase: currentRoas * (1 - efficiencyLoss * 1.5),
  };
}

/**
 * Compute a 0-100 health score and letter grade from core metrics.
 * Weights: ROI 0-30, ROAS 0-25, CTR 0-20, CVR 0-25.
 */
export function calculateHealthScore(metrics: {
  roi: number | null;
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
}) {
  let score = 0;
  let availableWeight = 0;
  const factors: Array<{ factor: string; score: number; status: string }> = [];
  const addFactor = (factor: string, value: number | null, weight: number, thresholds: Array<[number, number, string]>, fallback: number) => {
    if (value === null || !Number.isFinite(value)) return;
    availableWeight += weight;
    const matched = thresholds.find(([min]) => value >= min);
    const factorScore = matched ? matched[1] : fallback;
    score += factorScore;
    factors.push({ factor, score: factorScore, status: matched ? matched[2] : 'poor' });
  };

  // ROI component (0-30)
  addFactor('ROI', metrics.roi, 30, [[100, 30, 'excellent'], [50, 22, 'good'], [0, 15, 'acceptable']], 5);

  // ROAS component (0-25)
  addFactor('ROAS', metrics.roas, 25, [[3, 25, 'excellent'], [1.5, 18, 'good'], [1, 10, 'acceptable']], 3);

  // CTR component (0-20)
  addFactor('CTR', metrics.ctr, 20, [[3, 20, 'excellent'], [2, 15, 'good'], [1, 10, 'acceptable']], 3);

  // CVR component (0-25)
  addFactor('CVR', metrics.cvr, 25, [[5, 25, 'excellent'], [3, 18, 'good'], [1, 10, 'acceptable']], 3);

  score = availableWeight > 0 ? (score / availableWeight) * 100 : 0;

  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';

  return { score: Math.round(score), grade, factors };
}

/**
 * Assess risk factors for a campaign based on platform data and metrics.
 */
export function generateRiskAssessment(
  platforms: any[],
  platformsForDisplay: any[],
  metrics: { roi: number | null; roas: number | null },
  growthTrajectory: string | null,
  trendPercentage: number,
  extraFactors: Array<{ type: string; message: string; severity?: string }> = [],
) {
  let riskLevel = 'low';
  const riskFactors: Array<{ type: string; message: string }> = [];
  const checkedInputs = [
    { label: 'Available ROI', status: metrics.roi !== null ? 'checked' : 'unavailable', detail: metrics.roi !== null ? `${metrics.roi.toFixed(1)}%` : 'Unavailable from connected sources' },
    { label: 'Available ROAS', status: metrics.roas !== null ? 'checked' : 'unavailable', detail: metrics.roas !== null ? `${metrics.roas.toFixed(1)}x` : 'Unavailable from connected sources' },
    { label: 'Paid-platform concentration', status: platforms.length > 0 ? 'checked' : 'not_applicable', detail: platforms.length > 0 ? `${platforms.length} paid source${platforms.length === 1 ? '' : 's'} checked` : 'No paid-media source with spend, revenue, or conversions' },
    { label: '7-day trajectory', status: growthTrajectory ? 'checked' : 'not_enough_history', detail: growthTrajectory ? `${growthTrajectory}${trendPercentage ? ` (${trendPercentage.toFixed(1)}%)` : ''}` : 'Not enough compatible aggregate snapshot history' },
    { label: 'Budget pacing', status: 'separate_section', detail: 'Handled in Budget & Financial Analysis until a shared pacing signal is available here' },
  ];

  if (platforms.length === 1 && platformsForDisplay.length === 1) {
    riskFactors.push({ type: 'concentration', message: 'Single advertising platform - diversification recommended' });
    riskLevel = 'medium';
  } else if (platforms.length === 1 && platformsForDisplay.length > 1) {
    const platformsWithoutAdData = platformsForDisplay.filter(
      (p) => !platforms.some((pd) => pd.name === p.name),
    );
    riskFactors.push({
      type: 'concentration',
      message: `All advertising spend on ${platforms[0].name} - ${platformsWithoutAdData.map((p: any) => p.name).join(', ')} ${platformsWithoutAdData.length === 1 ? 'has' : 'have'} no advertising data`,
    });
    riskLevel = 'medium';
  } else if (platforms.length > 1 && platforms[0].spendShare > 70) {
    riskFactors.push({
      type: 'concentration',
      message: `${platforms[0].spendShare.toFixed(0)}% spend on ${platforms[0].name} - high concentration risk`,
    });
    riskLevel = 'medium';
  }

  if (metrics.roi !== null && metrics.roi < 0) {
    riskFactors.push({ type: 'performance', message: 'Negative ROI - immediate optimization required' });
    riskLevel = 'high';
  } else if (metrics.roas !== null && metrics.roas < 1) {
    riskFactors.push({ type: 'performance', message: 'ROAS below breakeven - review campaign strategy' });
    if (riskLevel === 'low') riskLevel = 'medium';
  }

  if (growthTrajectory === 'declining' && trendPercentage < -15) {
    riskFactors.push({ type: 'trend', message: `Performance declining ${Math.abs(trendPercentage).toFixed(0)}% - intervention needed` });
    if (riskLevel === 'low') riskLevel = 'medium';
  }

  for (const factor of extraFactors) {
    riskFactors.push({ type: factor.type, message: factor.message });
    if (factor.severity === 'high') riskLevel = 'high';
    else if (riskLevel === 'low') riskLevel = 'medium';
  }

  let riskExplanation = '';
  if (riskLevel === 'low') {
    riskExplanation = 'No significant risk factors identified from available connected-source inputs. Continue monitoring performance.';
  } else if (riskLevel === 'medium') {
    const reasons: string[] = [];
    if (platforms.length === 1 && platformsForDisplay.length === 1) reasons.push('single advertising platform');
    else if (platforms.length === 1 && platformsForDisplay.length > 1) reasons.push('advertising spend concentrated on one platform');
    if (platforms.length > 1 && platforms[0].spendShare > 70) reasons.push('high platform concentration');
    if (metrics.roas !== null && metrics.roas < 1) reasons.push('ROAS below breakeven');
    if (growthTrajectory === 'declining') reasons.push('declining performance trend');
    if (extraFactors.some((factor) => factor.type === 'kpi')) reasons.push('KPI underperformance');
    if (extraFactors.some((factor) => factor.type === 'benchmark')) reasons.push('benchmark underperformance');
    if (extraFactors.some((factor) => factor.type === 'freshness')) reasons.push('stale connected-source data');
    riskExplanation = `Moderate risk due to ${reasons.join(', ')}. Review recommended.`;
  } else {
    riskExplanation = metrics.roi !== null && metrics.roi < 0
      ? 'High risk: Campaign experiencing negative ROI. Immediate action required to prevent further losses.'
      : 'High risk due to configured risk factors from available connected-source inputs. Review immediately.';
  }

  return { riskLevel, riskFactors, riskExplanation, checkedInputs };
}

/**
 * Generate strategic recommendations based on platform data and overall metrics.
 */
export function generateRecommendations(
  platforms: any[],
  totalSpend: number,
  roas: number,
  roi: number,
  growthTrajectory: string | null,
  context: {
    hasSpend?: boolean;
    hasRevenue?: boolean;
    hasRoas?: boolean;
    hasRoi?: boolean;
    hasSessions?: boolean;
    hasUsers?: boolean;
    hasConversions?: boolean;
    hasCvr?: boolean;
    users?: number;
    sessions?: number;
    conversions?: number;
    revenue?: number;
    cvr?: number;
    paidMediaSources?: number;
    webAnalyticsSources?: number;
  } = {},
) {
  const recommendations: any[] = [];
  const paidMediaSourceCount = context.paidMediaSources ?? platforms.length;
  const comparablePaidPlatforms = platforms.filter((platform) =>
    platform.spend > 0 && platform.revenue > 0 && platform.roas > 0
  );
  const hasPaidFinancialInputs = paidMediaSourceCount > 0 &&
    comparablePaidPlatforms.length > 0 &&
    context.hasSpend === true &&
    context.hasRevenue === true &&
    context.hasRoas === true &&
    context.hasRoi === true &&
    totalSpend > 0;

  const topPlatform = comparablePaidPlatforms.length > 0
    ? comparablePaidPlatforms.reduce((top, p) => (p.roas > top.roas ? p : top))
    : null;
  const bottomPlatform = comparablePaidPlatforms.length > 1
    ? comparablePaidPlatforms.reduce((bottom, p) => (p.roas < bottom.roas ? p : bottom))
    : null;

  // Budget reallocation
  if (hasPaidFinancialInputs && comparablePaidPlatforms.length > 1 && topPlatform && bottomPlatform && topPlatform.roas > bottomPlatform.roas * 1.5) {
    const performanceGap = topPlatform.roas / bottomPlatform.roas;
    const reallocationPct = performanceGap > 3 ? 0.5 : performanceGap > 2 ? 0.3 : 0.2;
    const reallocationAmount = bottomPlatform.spend * reallocationPct;
    const conservativeTopRoas = topPlatform.roas * 0.9;
    const estimatedImpact = reallocationAmount * (conservativeTopRoas - bottomPlatform.roas);

    recommendations.push({
      priority: 'high',
      category: 'Budget Reallocation',
      action: `Shift ${(reallocationPct * 100).toFixed(0)}% ($${reallocationAmount.toFixed(0)}) from ${bottomPlatform.name} to ${topPlatform.name}`,
      expectedImpact: `+$${estimatedImpact.toFixed(0)} revenue`,
      investmentRequired: '$0 (reallocation)',
      timeline: 'Immediate',
      confidence: 'high',
      assumptions: [
        `${topPlatform.name} maintains ${(conservativeTopRoas / topPlatform.roas * 100).toFixed(0)}% of current efficiency`,
        'Sufficient audience scale available',
        'No major market changes',
      ],
      scenarios: {
        bestCase: `+$${(estimatedImpact * 1.3).toFixed(0)} revenue`,
        expected: `+$${estimatedImpact.toFixed(0)} revenue`,
        worstCase: `+$${(estimatedImpact * 0.7).toFixed(0)} revenue`,
      },
    });
  }

  // Scaling
  if (hasPaidFinancialInputs && roi > 50 && roas > 2 && growthTrajectory !== 'declining') {
    const scaleAmount = totalSpend * 0.5;
    const scalingModel = calculateDiminishingReturns(totalSpend, scaleAmount, roas);
    const expectedRevenue = scaleAmount * scalingModel.adjustedRoas;
    const expectedProfit = expectedRevenue - scaleAmount;
    const bestCaseProfit = scaleAmount * scalingModel.bestCase - scaleAmount;
    const worstCaseProfit = scaleAmount * scalingModel.worstCase - scaleAmount;

    recommendations.push({
      priority: 'high',
      category: 'Scaling Opportunity',
      action: 'Increase campaign budget by 50% to capitalize on strong performance',
      expectedImpact: `+$${expectedProfit.toFixed(0)} profit (${scalingModel.adjustedRoas.toFixed(1)}x ROAS)`,
      investmentRequired: `$${scaleAmount.toFixed(0)}`,
      timeline: '30 days',
      confidence: 'medium',
      assumptions: [
        `${scalingModel.efficiencyLoss.toFixed(0)}% efficiency loss from diminishing returns`,
        'Audience targeting remains effective at scale',
        'Market demand supports increased spend',
        'Creative performance remains stable',
      ],
      scenarios: {
        bestCase: `+$${bestCaseProfit.toFixed(0)} profit (${scalingModel.bestCase.toFixed(1)}x ROAS)`,
        expected: `+$${expectedProfit.toFixed(0)} profit (${scalingModel.adjustedRoas.toFixed(1)}x ROAS)`,
        worstCase: `+$${worstCaseProfit.toFixed(0)} profit (${scalingModel.worstCase.toFixed(1)}x ROAS)`,
      },
      disclaimer: 'Projections based on industry-standard diminishing returns. Actual results may vary based on audience saturation, competition, and creative fatigue.',
    });
  }

  // Optimization
  if (hasPaidFinancialInputs && bottomPlatform && bottomPlatform.roas < 1.5) {
    const targetRoas = 1.5;
    const currentRoasGap = targetRoas - bottomPlatform.roas;
    const potentialRevenueLift = bottomPlatform.spend * currentRoasGap;

    recommendations.push({
      priority: 'medium',
      category: 'Performance Optimization',
      action: `Optimize ${bottomPlatform.name} targeting and creative (current ROAS: ${bottomPlatform.roas.toFixed(1)}x)`,
      expectedImpact: `+$${potentialRevenueLift.toFixed(0)} revenue at 1.5x ROAS target`,
      investmentRequired: 'Creative & targeting resources',
      timeline: '60 days',
      confidence: 'medium',
      assumptions: [
        'Optimization achieves industry-average 1.5x ROAS',
        'Testing and iteration improve targeting precision',
        'Creative refresh reduces ad fatigue',
      ],
      scenarios: {
        bestCase: `+$${(potentialRevenueLift * 1.4).toFixed(0)} revenue (1.7x ROAS)`,
        expected: `+$${potentialRevenueLift.toFixed(0)} revenue (1.5x ROAS)`,
        worstCase: `+$${(potentialRevenueLift * 0.6).toFixed(0)} revenue (1.3x ROAS)`,
      },
      disclaimer: 'Optimization success depends on execution quality and market conditions. Historical improvements vary 20-40%.',
    });
  }

  // Diversification
  if (hasPaidFinancialInputs && comparablePaidPlatforms.length === 1) {
    const testBudget = totalSpend * 0.15;
    const conservativeRoas = roas * 0.7;
    const expectedRevenue = testBudget * conservativeRoas;
    const expectedProfit = expectedRevenue - testBudget;

    recommendations.push({
      priority: 'medium',
      category: 'Risk Mitigation',
      action: 'Test additional platforms to reduce single-platform dependency',
      expectedImpact: `${expectedProfit > 0 ? `+$${expectedProfit.toFixed(0)} profit` : 'Reduced platform risk'} from diversification`,
      investmentRequired: `$${testBudget.toFixed(0)} testing budget`,
      timeline: '90 days',
      confidence: 'low',
      assumptions: [
        'New platform achieves 70% of current ROAS initially',
        'Learning curve spans 60-90 days',
        'Risk reduction outweighs potential lower initial returns',
      ],
      scenarios: {
        bestCase: `+$${(testBudget * roas - testBudget).toFixed(0)} profit (matches current ROAS)`,
        expected: `+$${expectedProfit.toFixed(0)} profit (70% of current ROAS)`,
        worstCase: `-$${(testBudget * 0.4).toFixed(0)} loss (testing investment only)`,
      },
      disclaimer: 'Diversification is primarily a risk mitigation strategy. Initial ROI may be lower during testing phase.',
    });
  }

  if (recommendations.length === 0 &&
      paidMediaSourceCount === 0 &&
      (context.webAnalyticsSources || 0) > 0 &&
      (context.hasSessions === true || context.hasUsers === true) &&
      (context.hasConversions === true || context.hasRevenue === true)) {
    const webMetrics: string[] = [];
    if (context.hasUsers === true && Number.isFinite(context.users)) webMetrics.push(`${Math.round(context.users || 0).toLocaleString("en-US")} users`);
    if (context.hasSessions === true && Number.isFinite(context.sessions)) webMetrics.push(`${Math.round(context.sessions || 0).toLocaleString("en-US")} sessions`);
    if (context.hasConversions === true && Number.isFinite(context.conversions)) webMetrics.push(`${Math.round(context.conversions || 0).toLocaleString("en-US")} conversions`);
    if (context.hasRevenue === true && Number.isFinite(context.revenue)) webMetrics.push(`$${Math.round(context.revenue || 0).toLocaleString("en-US")} revenue`);
    if (context.hasCvr === true && Number.isFinite(context.cvr)) webMetrics.push(`${(context.cvr || 0).toFixed(1)}% conversion rate`);
    const webMetricSummary = webMetrics.length > 0 ? `Available data: ${webMetrics.join(", ")}. ` : "";
    recommendations.push({
      priority: 'medium',
      category: 'Website Outcomes',
      action: 'Review website conversion path before making paid-media budget decisions',
      expectedImpact: `${webMetricSummary}Shows whether available users or sessions are turning into conversions and revenue before spend changes are considered`,
      investmentRequired: 'Analysis only; connect a paid-media source for budget or channel recommendations',
      timeline: 'Next 7 days',
      confidence: context.hasCvr === true ? 'medium' : 'low',
      assumptions: [
        'Based only on connected web analytics and outcome metrics currently available',
        'No connected paid-media source is available, so this is not a spend, ROAS, CPA, CPC, CTR, or CPM recommendation',
      ],
    });
  }

  return recommendations;
}

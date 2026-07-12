export function selectGA4FinancialTotalsSource<T>(
  candidates: T[],
  fallback: T,
): T {
  return candidates.reduce((best, current) => (
    Number((current as any)?.revenue || 0) > Number((best as any)?.revenue || 0)
      ? current
      : best
  ), fallback);
}

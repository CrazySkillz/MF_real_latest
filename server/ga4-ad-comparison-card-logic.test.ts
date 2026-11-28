import { describe, expect, it } from "vitest";
import { formatGA4AdComparisonCardPct, selectGA4AdComparisonLeaderCards } from "../shared/ga4-ad-comparison-cards";
import { mergeGA4OverviewCampaignRevenueRows } from "../shared/ga4-traffic-window";

const row = (name: string, sessions: number, users: number, conversions: number, revenue: number) => ({
  name,
  sessions,
  users,
  conversions,
  revenue,
  conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
  revenuePerSession: sessions > 0 ? revenue / sessions : 0,
});

describe("GA4 Ad Comparison leader-card logic", () => {
  it("shows four explicit rankings, including a zero-rate campaign below 25 sessions", () => {
    const rows = [row("coffee_bags", 109, 7, 1, 40.5), row("served_here", 24, 5, 0, 0)];
    const before = structuredClone(rows);
    for (const metric of ["sessions", "users", "conversions", "revenue", "conversionRate"]) {
      const cards = selectGA4AdComparisonLeaderCards(rows, metric).rankings;
      expect(cards.map(card => card.title)).toEqual(["Highest Revenue", "Highest Conversion Rate", "Lowest Revenue", "Lowest Conversion Rate"]);
      expect(cards.map(card => card.leaders.map(leader => leader.name))).toEqual([["coffee_bags"], ["coffee_bags"], ["served_here"], ["served_here"]]);
    }
    expect(rows).toEqual(before);
  });

  it("uses supplied conversion rates rather than recomputing them from event counts", () => {
    const cards = selectGA4AdComparisonLeaderCards([
      { ...row("more events", 100, 50, 40, 10), conversionRate: 5 },
      { ...row("more converting sessions", 100, 50, 20, 20), conversionRate: 10 },
    ], "sessions").rankings;
    expect(cards[1].leaders[0].name).toBe("more converting sessions");
    expect(cards[3].leaders[0].conversionRate).toBe(5);
  });

  it("includes recorded zeros and reports every exact tie deterministically", () => {
    const cards = selectGA4AdComparisonLeaderCards([row("B", 24, 5, 0, 0), row("A", 109, 7, 0, 0)], "revenue").rankings;
    for (const card of cards) expect(card.leaders.map(leader => leader.name)).toEqual(["A", "B"]);
  });

  it("ranks mapped revenue without sessions but excludes that row from rate comparisons", () => {
    const cards = selectGA4AdComparisonLeaderCards([row("mapped", 0, 0, 0, 300), row("A", 100, 90, 10, 50), row("B", 2, 1, 0, -10)], "sessions").rankings;
    expect(cards.map(card => card.leaders[0].name)).toEqual(["mapped", "A", "B", "B"]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, null, undefined])("does not rank incomplete revenue as zero (%s)", revenue => {
    const cards = selectGA4AdComparisonLeaderCards([row("A", 100, 90, 10, 50), { ...row("B", 24, 5, 0, 0), revenue } as any], "revenue").rankings;
    expect(cards[0].leaders).toEqual([]); expect(cards[2].leaders).toEqual([]);
    expect(cards[0].unavailableReason).toBe("Data unavailable");
    expect(cards[1].leaders[0].name).toBe("A");
  });

  it("does not fabricate rate leaders from missing rates or insufficient session data", () => {
    for (const second of [{ ...row("B", 24, 5, 0, 0), conversionRate: Number.NaN }, row("B", 0, 0, 0, 0)]) {
      const cards = selectGA4AdComparisonLeaderCards([row("A", 100, 90, 10, 50), second], "sessions").rankings;
      expect(cards[1].leaders).toEqual([]); expect(cards[3].leaders).toEqual([]);
      expect(cards[0].leaders[0].name).toBe("A");
    }
    for (const rows of [[], [row("A", 1, 1, 0, 0)]]) {
      expect(selectGA4AdComparisonLeaderCards(rows, "sessions").rankings.every(card => card.leaders.length === 0)).toBe(true);
    }
  });
  it("ranks conversions per session consistently with Overview", () => {
    const merged = mergeGA4OverviewCampaignRevenueRows([
      { campaign: "high event count", sessions: 76, conversions: 76, sessionKeyEventRate: 0.25 },
      { campaign: "more converting sessions", sessions: 40, conversions: 10, sessionKeyEventRate: 0.5 },
    ], [], ["high event count", "more converting sessions"]);
    const rows = merged.map((item) => ({ name: item.campaign, ...item, conversionRate: item.conversions / item.sessions * 100 }));
    const cards = selectGA4AdComparisonLeaderCards(rows, "conversionRate");
    expect(cards.bestPerforming?.name).toBe("high event count");
    expect(cards.mostEfficient?.name).toBe("high event count");
    expect(cards.needsAttention?.name).toBe("more converting sessions");
    expect(cards.bestPerforming?.conversionRate).toBe(100);
  });
  it("ranks Best Performing by conversions regardless of the dropdown metric", () => {
    const rows = [
      row("session leader", 200, 150, 10, 100),
      row("revenue leader", 50, 40, 8, 900),
    ];

    const bySessions = selectGA4AdComparisonLeaderCards(rows, "sessions");
    const byRevenue = selectGA4AdComparisonLeaderCards(rows, "revenue");

    expect(bySessions.bestPerforming?.name).toBe("session leader");
    expect(byRevenue.bestPerforming?.name).toBe("session leader");
    expect(bySessions.mostEfficient?.name).toBe("revenue leader");
    expect(byRevenue.mostEfficient?.name).toBe("revenue leader");
  });

  it("does not call Campaign2's zero-conversion traffic leader Best Performing", () => {
    const rows = [
      row("yesop_retargeti", 76, 76, 76, 65069.86),
      row("yesop_email_nurture", 384, 384, 0, 100),
    ];
    for (const metric of ["sessions", "users", "conversions", "revenue", "conversionRate"]) {
      const cards = selectGA4AdComparisonLeaderCards(rows, metric);
      expect(cards.bestPerforming?.name).toBe("yesop_retargeti");
      expect(cards.mostEfficient?.name).toBe("yesop_retargeti");
      expect(cards.needsAttention?.name).toBe("yesop_email_nurture");
    }
  });

  it("does not label the most efficient row as Needs Attention just to avoid duplicating Best Performing", () => {
    const rows = [
      row("yesop_retargeting", 230, 180, 28, 1000),
      row("yesop_email_nurture", 150, 120, 19, 2814.23),
    ];

    const cards = selectGA4AdComparisonLeaderCards(rows, "sessions");

    expect(cards.bestPerforming?.name).toBe("yesop_retargeting");
    expect(cards.mostEfficient?.name).toBe("yesop_email_nurture");
    expect(cards.needsAttention?.name).toBe("yesop_retargeting");
  });

  it("only avoids a Best Performing duplicate when another row is tied for the lowest conversion rate", () => {
    const rows = [
      row("volume leader weak", 300, 250, 30, 500),
      row("also weak", 120, 100, 12, 250),
      row("strong converter", 80, 70, 10, 800),
    ];

    const cards = selectGA4AdComparisonLeaderCards(rows, "sessions");

    expect(cards.bestPerforming?.name).toBe("volume leader weak");
    expect(cards.needsAttention?.name).toBe("also weak");
    expect(cards.needsAttention?.conversionRate).toBe(cards.bestPerforming?.conversionRate);
  });

  it("ignores tiny low-signal rows for Needs Attention when meaningful-volume rows exist", () => {
    const rows = [
      row("large strong", 1000, 800, 200, 5000),
      row("meaningful weak", 120, 100, 2, 300),
      row("tiny weak", 3, 3, 0, 0),
    ];

    const cards = selectGA4AdComparisonLeaderCards(rows, "sessions");

    expect(cards.needsAttention?.name).toBe("meaningful weak");
  });

  it("does not rank zero-session mapped revenue above observed conversions", () => {
    const rows = [
      row("mapped external revenue", 0, 0, 0, 3000),
      row("tracked GA4 row", 100, 80, 10, 500),
    ];

    const cards = selectGA4AdComparisonLeaderCards(rows, "revenue");

    expect(cards.bestPerforming?.name).toBe("tracked GA4 row");
    expect(cards.mostEfficient?.name).toBe("tracked GA4 row");
    expect(cards.needsAttention?.name).toBe("tracked GA4 row");
  });

  it("does not invent a conversion or rate leader when every campaign has zero conversions", () => {
    const cards = selectGA4AdComparisonLeaderCards([
      row("zero A", 100, 90, 0, 0),
      row("zero B", 50, 40, 0, 0),
    ], "sessions");
    expect(cards.bestPerforming).toBeUndefined();
    expect(cards.mostEfficient).toBeUndefined();
  });

  it("uses exact conversion rates for close leader-card decisions that round to the same one-decimal label", () => {
    const rows = [
      row("yesop_retargeting", 273, 273, 34, 6253.92),
      row("yesop_paid_social", 200, 200, 25, 4389.14),
      row("yesop_email_nurture", 192, 192, 24, 3513.33),
    ];

    const cards = selectGA4AdComparisonLeaderCards(rows, "sessions");

    expect(cards.bestPerforming?.name).toBe("yesop_retargeting");
    expect(cards.mostEfficient?.name).toBe("yesop_paid_social");
    expect(cards.needsAttention?.name).toBe("yesop_retargeting");
    expect(cards.needsAttention?.conversionRate).toBeLessThan(cards.mostEfficient?.conversionRate || 0);
    expect(formatGA4AdComparisonCardPct(cards.needsAttention?.conversionRate || 0)).toBe("12.45%");
    expect(formatGA4AdComparisonCardPct(cards.mostEfficient?.conversionRate || 0)).toBe("12.50%");
  });
});

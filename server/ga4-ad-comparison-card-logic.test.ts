import { describe, expect, it } from "vitest";
import { selectGA4AdComparisonLeaderCards } from "../shared/ga4-ad-comparison-cards";

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
  it("uses the selected metric only for Best Performing", () => {
    const rows = [
      row("session leader", 200, 150, 10, 100),
      row("revenue leader", 50, 40, 8, 900),
    ];

    const bySessions = selectGA4AdComparisonLeaderCards(rows, "sessions");
    const byRevenue = selectGA4AdComparisonLeaderCards(rows, "revenue");

    expect(bySessions.bestPerforming?.name).toBe("session leader");
    expect(byRevenue.bestPerforming?.name).toBe("revenue leader");
    expect(bySessions.mostEfficient?.name).toBe("revenue leader");
    expect(byRevenue.mostEfficient?.name).toBe("revenue leader");
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
      row("volume leader weak", 300, 250, 15, 500),
      row("also weak", 120, 100, 6, 250),
      row("strong converter", 80, 70, 20, 800),
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

  it("keeps zero-session mapped revenue rows eligible for Best Performing revenue but not efficiency cards", () => {
    const rows = [
      row("mapped external revenue", 0, 0, 0, 3000),
      row("tracked GA4 row", 100, 80, 10, 500),
    ];

    const cards = selectGA4AdComparisonLeaderCards(rows, "revenue");

    expect(cards.bestPerforming?.name).toBe("mapped external revenue");
    expect(cards.mostEfficient?.name).toBe("tracked GA4 row");
    expect(cards.needsAttention?.name).toBe("tracked GA4 row");
  });
});

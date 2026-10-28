import { describe, expect, it } from "vitest";
import { ODDS_DENOMINATOR, ODDS_TABLE, SERIES, TIERS, rowForTicket } from "@/lib/girls";

describe("odds table", () => {
  it("has 18 rows", () => {
    expect(ODDS_TABLE).toHaveLength(18);
    expect(new Set(ODDS_TABLE.map((r) => r.key)).size).toBe(18);
  });

  it("adds up to exactly 100%", () => {
    expect(ODDS_TABLE.reduce((s, r) => s + r.weight, 0)).toBe(ODDS_DENOMINATOR);
    expect(SERIES.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(TIERS.reduce((s, x) => s + x.weight, 0)).toBe(100);
  });

  it("gives each series exactly its series weight", () => {
    for (const series of SERIES) {
      const rows = ODDS_TABLE.filter((r) => r.series.id === series.id);
      expect(rows).toHaveLength(3);
      expect(rows.reduce((s, r) => s + r.weight, 0)).toBe(series.weight * 100);
    }
  });

  it("uses series weight x tier weight for every row", () => {
    expect(ODDS_TABLE.find((r) => r.key === "priestess:divine")?.percent).toBe(0.25);
    for (const r of ODDS_TABLE) expect(r.weight).toBe(r.series.weight * r.tier.weight);
  });

  it("applies the tier multipliers", () => {
    const rate = (k: string) => ODDS_TABLE.find((r) => r.key === k)?.milkRate;
    expect(rate("trader:devoted")).toBe(12_000);
    expect(rate("trader:gilded")).toBe(30_000);
    expect(rate("trader:divine")).toBe(72_000);
    expect(rate("priestess:divine")).toBe(288_000);
  });

  it("maps every ticket to the row that owns it", () => {
    const counts = new Map<string, number>();
    for (let t = 0; t < ODDS_DENOMINATOR; t++) {
      const k = rowForTicket(t).key;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const r of ODDS_TABLE) expect(counts.get(r.key)).toBe(r.weight);
    expect(() => rowForTicket(ODDS_DENOMINATOR)).toThrow();
    expect(() => rowForTicket(-1)).toThrow();
  });
});

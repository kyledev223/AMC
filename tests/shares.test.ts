import { describe, expect, it } from "vitest";
import { chunk, planEpoch } from "@/lib/shares";

describe("planEpoch", () => {
  it("splits the pool by milk", () => {
    const plan = planEpoch(
      [
        { assetId: "a", wallet: "W1", milkRate: 12_000 },
        { assetId: "b", wallet: "W1", milkRate: 48_000 },
        { assetId: "c", wallet: "W2", milkRate: 60_000 },
      ],
      1_200_000n,
      new Map(),
      0n,
    );
    expect(plan.totalMilk).toBe(120_000n);
    expect(plan.payouts).toEqual([
      { wallet: "W1", amount: 600_000n, milk: 60_000n },
      { wallet: "W2", amount: 600_000n, milk: 60_000n },
    ]);
    expect(plan.paying + plan.rounding).toBe(1_200_000n);
  });

  it("never assigns more than the pool", () => {
    const holdings = Array.from({ length: 7 }, (_, i) => ({ assetId: `g${i}`, wallet: `W${i % 3}`, milkRate: 12_000 + i * 997 }));
    const plan = planEpoch(holdings, 1_000_003n, new Map(), 0n);
    const assigned = plan.shares.reduce((s, x) => s + x.amount, 0n);
    expect(assigned).toBeLessThanOrEqual(1_000_003n);
    expect(assigned + plan.rounding).toBe(1_000_003n);
  });

  it("carries dust and pays it once it clears the minimum", () => {
    const holdings = [
      { assetId: "big", wallet: "Whale", milkRate: 990_000 },
      { assetId: "small", wallet: "Shrimp", milkRate: 10_000 },
    ];
    const first = planEpoch(holdings, 1_000_000n, new Map(), 20_000n);
    expect(first.payouts.map((p) => p.wallet)).toEqual(["Whale"]);
    expect(first.carries.get("Shrimp")).toBe(10_000n);

    const second = planEpoch(holdings, 1_000_000n, first.carries, 20_000n);
    expect(second.payouts.find((p) => p.wallet === "Shrimp")?.amount).toBe(20_000n);
    expect(second.carries.size).toBe(0);
  });

  it("pays carried dust to a wallet that sold its girls", () => {
    const plan = planEpoch([{ assetId: "a", wallet: "New", milkRate: 1 }], 0n, new Map([["Old", 50n]]), 10n);
    expect(plan.payouts).toEqual([{ wallet: "Old", amount: 50n, milk: 0n }]);
  });

  it("does nothing with no girls", () => {
    const plan = planEpoch([], 5_000n, new Map(), 1n);
    expect(plan.payouts).toEqual([]);
    expect(plan.rounding).toBe(5_000n);
  });
});

describe("chunk", () => {
  it("batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

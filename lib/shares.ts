/**
 * Pure share math for one epoch. All amounts are integer base units (lamports or token units).
 * Each girl earns pool * girlMilk / totalMilk, rounded down. A wallet is owed the sum of its
 * girls plus any dust carried from earlier epochs. Wallets owed less than minPayout carry it.
 */

export type Holding = { assetId: string; wallet: string; milkRate: number };

export type EpochPlan = {
  totalMilk: bigint;
  shares: { assetId: string; wallet: string; milkRate: number; amount: bigint }[];
  payouts: { wallet: string; amount: bigint; milk: bigint }[];
  /** New carry balance per wallet after this epoch. Wallets absent here have zero carry. */
  carries: Map<string, bigint>;
  /** Sum of payouts. */
  paying: bigint;
  /** Pool left unassigned by rounding. Stays in the pool for the next epoch. */
  rounding: bigint;
};

export function planEpoch(
  holdings: Holding[],
  pool: bigint,
  carriesIn: Map<string, bigint>,
  minPayout: bigint,
): EpochPlan {
  if (pool < 0n) throw new RangeError("pool must not be negative");
  const totalMilk = holdings.reduce((sum, h) => sum + BigInt(h.milkRate), 0n);

  const shares = holdings.map((h) => ({
    ...h,
    amount: totalMilk === 0n ? 0n : (pool * BigInt(h.milkRate)) / totalMilk,
  }));
  const assigned = shares.reduce((sum, s) => sum + s.amount, 0n);

  const owed = new Map<string, { amount: bigint; milk: bigint }>();
  for (const s of shares) {
    const cur = owed.get(s.wallet) ?? { amount: 0n, milk: 0n };
    owed.set(s.wallet, { amount: cur.amount + s.amount, milk: cur.milk + BigInt(s.milkRate) });
  }
  // Dust is owed even if the wallet no longer holds a girl.
  for (const [wallet, carry] of carriesIn) {
    if (carry <= 0n) continue;
    const cur = owed.get(wallet) ?? { amount: 0n, milk: 0n };
    owed.set(wallet, { amount: cur.amount + carry, milk: cur.milk });
  }

  const payouts: EpochPlan["payouts"] = [];
  const carries = new Map<string, bigint>();
  const wallets = [...owed].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [wallet, { amount, milk }] of wallets) {
    if (amount <= 0n) continue;
    if (amount >= minPayout) payouts.push({ wallet, amount, milk });
    else carries.set(wallet, amount);
  }

  return {
    totalMilk,
    shares,
    payouts,
    carries,
    paying: payouts.reduce((sum, p) => sum + p.amount, 0n),
    rounding: pool - assigned,
  };
}

/** Splits a list into batches of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

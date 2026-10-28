import "server-only";
import { db } from "./db";
import { env } from "./env";
import { EPOCH_SECONDS } from "./config";
import { SERIES } from "./girls";

/**
 * Read-side queries for pages. Every function returns an empty-state value when the database
 * is not configured or unreachable, so pages render before launch.
 */

async function safe<T>(fallback: T, fn: (client: NonNullable<ReturnType<typeof db>>) => Promise<T>): Promise<T> {
  const client = db();
  if (!client) return fallback;
  try {
    return await fn(client);
  } catch (err) {
    console.error("[queries]", err instanceof Error ? err.message : err);
    return fallback;
  }
}

export type NetworkStats = {
  totalMilk: number;
  girls: number;
  burned: string; // base units
  paidOut: string; // base units of SOL (lamports) for the SOL ledger
  holders: number;
  epochs: number;
  distributionsEnabled: boolean;
  paused: boolean;
  nextEpochAt: number; // unix ms
};

export function nextEpochAt(now = Date.now()): number {
  const ms = EPOCH_SECONDS * 1000;
  return Math.floor(now / ms) * ms + ms;
}

export async function isPaused(): Promise<boolean> {
  return safe(false, async (c) => (await c.setting.findUnique({ where: { key: "distributions_paused" } }))?.value === "true");
}

export async function getNetworkStats(): Promise<NetworkStats> {
  const base: NetworkStats = {
    totalMilk: 0,
    girls: 0,
    burned: "0",
    paidOut: "0",
    holders: 0,
    epochs: 0,
    distributionsEnabled: env().DISTRIBUTIONS_ENABLED,
    paused: false,
    nextEpochAt: nextEpochAt(),
  };
  return safe(base, async (c) => {
    const [agg, paid, holders, epochs, paused] = await Promise.all([
      c.mint.aggregate({ _sum: { milkRate: true, burnAmount: true }, _count: true }),
      c.payout.aggregate({ _sum: { amount: true }, where: { status: "sent", asset: "SOL" } }),
      c.mint.groupBy({ by: ["owner"] }).then((r) => r.length),
      c.epoch.count({ where: { status: "complete", dryRun: false } }),
      isPaused(),
    ]);
    return {
      ...base,
      totalMilk: agg._sum.milkRate ?? 0,
      girls: agg._count,
      burned: (agg._sum.burnAmount ?? 0n).toString(),
      paidOut: (paid._sum.amount ?? 0n).toString(),
      holders,
      epochs,
      paused,
    };
  });
}

export type PayoutRow = {
  id: string;
  epochId: number;
  wallet: string;
  amount: string;
  asset: string;
  decimals: number;
  milk: string;
  txSig: string | null;
  status: string;
  createdAt: string;
};

function toPayoutRow(p: {
  id: string; epochId: number; wallet: string; amount: bigint; asset: string; decimals: number; milk: bigint; txSig: string | null; status: string; createdAt: Date;
}): PayoutRow {
  return { ...p, amount: p.amount.toString(), milk: p.milk.toString(), createdAt: p.createdAt.toISOString() };
}

export async function getRecentPayouts(limit = 20): Promise<PayoutRow[]> {
  return safe([], async (c) =>
    (await c.payout.findMany({ where: { status: { in: ["sent", "dry_run"] } }, orderBy: { createdAt: "desc" }, take: limit })).map(toPayoutRow),
  );
}

export async function getPayoutsPage(opts: { page: number; pageSize: number; wallet?: string }): Promise<{ rows: PayoutRow[]; total: number }> {
  const where = { status: { in: ["sent", "dry_run"] }, ...(opts.wallet ? { wallet: opts.wallet } : {}) };
  return safe({ rows: [], total: 0 }, async (c) => {
    const [rows, total] = await Promise.all([
      c.payout.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
      c.payout.count({ where }),
    ]);
    return { rows: rows.map(toPayoutRow), total };
  });
}

export type MintRow = {
  assetId: string;
  owner: string;
  minter: string;
  series: string;
  tier: string;
  serial: number;
  milkRate: number;
  burnTx: string;
  burnAmount: string;
  seedCommit: string;
  seedReveal: string;
  blockhash: string;
  roll: string;
  createdAt: string;
  earned: string;
};

type MintRecord = {
  assetId: string; owner: string; minter: string; series: string; tier: string; serial: number; milkRate: number;
  burnTx: string; burnAmount: bigint; seedCommit: string; seedReveal: string; blockhash: string; roll: string; createdAt: Date;
};

function toMintRow(m: MintRecord, earned: bigint = 0n): MintRow {
  return { ...m, burnAmount: m.burnAmount.toString(), createdAt: m.createdAt.toISOString(), earned: earned.toString() };
}

export async function getMint(assetId: string): Promise<MintRow | null> {
  return safe(null, async (c) => {
    const m = await c.mint.findUnique({ where: { assetId } });
    if (!m) return null;
    const earned = await c.share.aggregate({ _sum: { amount: true }, where: { assetId, epoch: { dryRun: false } } });
    return toMintRow(m, earned._sum.amount ?? 0n);
  });
}

export async function getMintsByAssetIds(ids: string[]): Promise<MintRow[]> {
  if (ids.length === 0) return [];
  return safe([], async (c) => {
    const [mints, earned] = await Promise.all([
      c.mint.findMany({ where: { assetId: { in: ids } }, orderBy: { createdAt: "desc" } }),
      c.share.groupBy({ by: ["assetId"], _sum: { amount: true }, where: { assetId: { in: ids }, epoch: { dryRun: false } } }),
    ]);
    const byId = new Map(earned.map((e) => [e.assetId, e._sum.amount ?? 0n]));
    return mints.map((m) => toMintRow(m, byId.get(m.assetId)));
  });
}

export async function getMintsByOwner(owner: string): Promise<MintRow[]> {
  return safe([], async (c) => {
    const ids = (await c.mint.findMany({ where: { owner }, select: { assetId: true } })).map((m) => m.assetId);
    return getMintsByAssetIds(ids);
  });
}

export async function getRecentMints(limit = 12): Promise<MintRow[]> {
  return safe([], async (c) => (await c.mint.findMany({ orderBy: { createdAt: "desc" }, take: limit })).map((m) => toMintRow(m)));
}

export type GirlShareRow = { epochId: number; wallet: string; amount: string; milkRate: number; at: string; dryRun: boolean };

export async function getGirlShares(assetId: string, limit = 30): Promise<GirlShareRow[]> {
  return safe([], async (c) =>
    (
      await c.share.findMany({ where: { assetId }, include: { epoch: { select: { startedAt: true, dryRun: true } } }, orderBy: { epochId: "desc" }, take: limit })
    ).map((s) => ({ epochId: s.epochId, wallet: s.wallet, amount: s.amount.toString(), milkRate: s.milkRate, at: s.epoch.startedAt.toISOString(), dryRun: s.epoch.dryRun })),
  );
}

export async function getSeriesCounts(): Promise<{ series: string; tier: string; count: number }[]> {
  return safe([], async (c) =>
    (await c.mint.groupBy({ by: ["series", "tier"], _count: true })).map((g) => ({ series: g.series, tier: g.tier, count: g._count })),
  );
}

export type EpochRow = { id: number; startedAt: string; poolAmount: string; totalMilk: string; holders: number; girls: number; status: string; dryRun: boolean; asset: string; paid: string };

export async function getRecentEpochs(limit = 48): Promise<EpochRow[]> {
  return safe([], async (c) => {
    const epochs = await c.epoch.findMany({ orderBy: { id: "desc" }, take: limit });
    const paid = await c.payout.groupBy({ by: ["epochId"], _sum: { amount: true }, where: { epochId: { in: epochs.map((e) => e.id) }, status: { in: ["sent", "dry_run"] } } });
    const byId = new Map(paid.map((p) => [p.epochId, p._sum.amount ?? 0n]));
    return epochs.map((e) => ({
      id: e.id,
      startedAt: e.startedAt.toISOString(),
      poolAmount: e.poolAmount.toString(),
      totalMilk: e.totalMilk.toString(),
      holders: e.holders,
      girls: e.girls,
      status: e.status,
      dryRun: e.dryRun,
      asset: e.asset,
      paid: (byId.get(e.id) ?? 0n).toString(),
    }));
  });
}

export const RANGES = {
  "1m": 60_000,
  "1h": 3_600_000,
  "6h": 21_600_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
} as const;
export type Range = keyof typeof RANGES;

export type StatSeriesPoint = { t: number; totalMilk: number; girls: number; burned: string; paidOut: string; pool: string };

/** Chart points inside the range, plus the last point before it so the line starts at the left edge. */
export async function getStatSeries(range: Range, now = Date.now()): Promise<StatSeriesPoint[]> {
  const since = new Date(now - RANGES[range]);
  return safe([], async (c) => {
    const [before, inside] = await Promise.all([
      c.statPoint.findFirst({ where: { timestamp: { lt: since } }, orderBy: { timestamp: "desc" } }),
      c.statPoint.findMany({ where: { timestamp: { gte: since } }, orderBy: { timestamp: "asc" }, take: 2000 }),
    ]);
    const pts = (before ? [{ ...before, timestamp: since }] : []).concat(inside);
    return pts.map((p) => ({
      t: p.timestamp.getTime(),
      totalMilk: Number(p.totalMilk),
      girls: p.girls,
      burned: p.burned.toString(),
      paidOut: p.paidOut.toString(),
      pool: p.pool.toString(),
    }));
  });
}

export const SERIES_ORDER = SERIES.map((s) => s.id);

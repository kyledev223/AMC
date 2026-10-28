import "server-only";
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  type Keypair,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import { requireDb } from "./db";
import { ConfigError, env, requireEnv } from "./env";
import { CLUSTER, EPOCH_SECONDS } from "./config";
import { getConnection, getMintInfo, poolKeypair } from "./solana";
import { snapshotCollection } from "./das";
import { chunk, planEpoch, type Holding } from "./shares";
import { reconcilePendingMints, writeStatPoint } from "./mint";

/**
 * The distribution worker. One run handles one 10-minute epoch:
 *   1. finish any earlier epoch left mid-payout,
 *   2. lock this epoch's row, read the pool, snapshot holders, plan every payout and save the plan,
 *   3. send the plan in batches, writing each batch's signature before it is broadcast.
 *
 * Idempotency: the plan is saved before anything is sent, and a batch is only re-sent once its
 * previous signature is known to have failed or its blockhash has expired, so a crash at any point
 * resumes without paying anyone twice.
 */

const LOCK_MS = 5 * 60_000;
/** Stop starting new batches after this long so the function returns inside its time limit. */
const TIME_BUDGET_MS = 240_000;
const SOL_BATCH = 18;
const TOKEN_BATCH = 5;
const MAX_ATTEMPTS = 5;

export type RunResult =
  | { status: "skipped"; reason: string; epochId?: number }
  | { status: "complete" | "paying"; epochId: number; payouts: number; sent: number; dryRun: boolean; pool: string; totalMilk: string };

export function epochIdFor(now = Date.now()): number {
  return Math.floor(now / (EPOCH_SECONDS * 1000));
}

export async function isPausedSetting(): Promise<boolean> {
  const row = await requireDb().setting.findUnique({ where: { key: "distributions_paused" } });
  return row?.value === "true";
}

export async function setPaused(paused: boolean): Promise<void> {
  await requireDb().setting.upsert({
    where: { key: "distributions_paused" },
    create: { key: "distributions_paused", value: String(paused) },
    update: { value: String(paused) },
  });
}

type Opts = { now?: number; force?: boolean; dryRun?: boolean; log?: (msg: string) => void };

export async function runDistribution(opts: Opts = {}): Promise<RunResult> {
  const log = opts.log ?? ((m: string) => console.log(`[distribute] ${m}`));
  const e = env();
  const started = Date.now();
  const db = requireDb();

  // Mints whose confirm request died are recovered here, before the snapshot.
  const rec = await reconcilePendingMints().catch((err) => {
    log(`reconcile failed: ${err instanceof Error ? err.message : err}`);
    return { finalized: 0, dropped: 0 };
  });
  if (rec.finalized || rec.dropped) log(`reconciled mints: ${rec.finalized} recorded, ${rec.dropped} dropped`);

  if (!e.DISTRIBUTIONS_ENABLED && !opts.force) return { status: "skipped", reason: "DISTRIBUTIONS_ENABLED is false" };
  if (await isPausedSetting()) return { status: "skipped", reason: "paused by admin" };

  const dryRun = opts.dryRun ?? e.DRY_RUN;
  if (e.PAYOUT_ASSET === "AMC_TOKENIZED") assertTokenizedAllowed(dryRun);
  const pool = dryRun ? null : poolKeypair();

  // 1. Earlier epochs left in "paying" are finished first so the pool balance is accurate.
  const unfinished = await db.epoch.findMany({ where: { status: "paying", dryRun: false }, orderBy: { id: "asc" } });
  for (const ep of unfinished) {
    // Another run is paying it. Planning now would count its unsent payouts as pool, so wait.
    if (!(await acquireLock(ep.id))) return { status: "skipped", reason: `epoch ${ep.id} is being paid by another run`, epochId: ep.id };
    log(`resuming epoch ${ep.id}`);
    const done = await sendPlanned(ep.id, pool!, started, log);
    if (!done || ep.id === epochIdFor(opts.now)) return { status: done ? "complete" : "paying", epochId: ep.id, ...(await summary(ep.id)), dryRun: false };
  }

  // 2. This epoch.
  const epochId = epochIdFor(opts.now);
  const existing = await db.epoch.findUnique({ where: { id: epochId } });
  if (existing && existing.status !== "computing") return { status: "skipped", reason: `epoch ${epochId} already ${existing.status}`, epochId };
  if (!existing) {
    try {
      await db.epoch.create({
        data: { id: epochId, status: "computing", asset: e.PAYOUT_ASSET, dryRun, lockedUntil: new Date(Date.now() + LOCK_MS) },
      });
    } catch {
      return { status: "skipped", reason: `epoch ${epochId} is locked by another run`, epochId };
    }
  } else if (!(await acquireLock(epochId))) {
    return { status: "skipped", reason: `epoch ${epochId} is locked by another run`, epochId };
  }

  try {
    await planAndSave(epochId, dryRun, log);
  } catch (err) {
    await db.epoch.update({ where: { id: epochId }, data: { status: "failed", note: errText(err), lockedUntil: null } });
    throw err;
  }

  if (dryRun) {
    await db.epoch.update({ where: { id: epochId }, data: { status: "complete", finishedAt: new Date(), lockedUntil: null } });
    return { status: "complete", epochId, ...(await summary(epochId)), dryRun };
  }

  const done = await sendPlanned(epochId, pool!, started, log);
  return { status: done ? "complete" : "paying", epochId, ...(await summary(epochId)), dryRun };
}

async function summary(epochId: number) {
  const db = requireDb();
  const [ep, total, sent] = await Promise.all([
    db.epoch.findUniqueOrThrow({ where: { id: epochId } }),
    db.payout.count({ where: { epochId } }),
    db.payout.count({ where: { epochId, status: { in: ["sent", "dry_run"] } } }),
  ]);
  return { payouts: total, sent, pool: ep.poolAmount.toString(), totalMilk: ep.totalMilk.toString() };
}

/** Takes the epoch's lock if it is free or expired. Compare-and-set so only one run wins. */
async function acquireLock(epochId: number): Promise<boolean> {
  const r = await requireDb().epoch.updateMany({
    where: { id: epochId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    data: { lockedUntil: new Date(Date.now() + LOCK_MS) },
  });
  return r.count === 1;
}

async function renewLock(epochId: number) {
  await requireDb().epoch.update({ where: { id: epochId }, data: { lockedUntil: new Date(Date.now() + LOCK_MS) } });
}

/** Reads the pool, snapshots holders, computes shares and saves every payout as pending. */
async function planAndSave(epochId: number, dryRun: boolean, log: (m: string) => void) {
  const db = requireDb();
  const e = env();
  const asset = e.PAYOUT_ASSET;

  const decimals = asset === "SOL" ? 9 : (await getMintInfo(requireEnv("PAYOUT_TOKEN_MINT"))).decimals;
  const minPayout = BigInt(Math.round(e.MIN_PAYOUT * 10 ** decimals));

  // Pool balance, minus the gas reserve and dust already owed to wallets.
  const carryRows = dryRun ? [] : await db.carry.findMany({ where: { asset } });
  const carriesIn = new Map(carryRows.map((c) => [c.wallet, c.amount]));
  const carryTotal = carryRows.reduce((s, c) => s + c.amount, 0n);

  if (asset === "AMC_TOKENIZED" && !dryRun) await swapPoolToPayoutToken(log);
  // A dry run with no pool configured still shows who would be paid, with zero amounts.
  const balance = dryRun && !e.POOL_WALLET ? 0n : await poolBalance(asset);
  const reserve = asset === "SOL" ? BigInt(Math.round(e.GAS_RESERVE_SOL * LAMPORTS_PER_SOL)) : 0n;
  let distributable = balance - reserve - carryTotal;
  if (distributable < 0n) distributable = 0n;
  log(`epoch ${epochId}: balance ${balance}, reserve ${reserve}, carry ${carryTotal}, distributable ${distributable}`);

  // Snapshot every girl and her current owner, joined to her milk rate.
  const holders = (await snapshotCollection()).filter((h) => !h.burnt);
  const mints = await db.mint.findMany({ where: { assetId: { in: holders.map((h) => h.assetId) } }, select: { assetId: true, milkRate: true, owner: true } });
  const byId = new Map(mints.map((m) => [m.assetId, m]));
  const holdings: Holding[] = [];
  const ownerChanges: { assetId: string; owner: string }[] = [];
  for (const h of holders) {
    const m = byId.get(h.assetId);
    if (!m) continue; // Not minted through us (should not happen: only our authority can add to the collection).
    holdings.push({ assetId: h.assetId, wallet: h.owner, milkRate: m.milkRate });
    if (m.owner !== h.owner) ownerChanges.push({ assetId: h.assetId, owner: h.owner });
  }

  const plan = planEpoch(holdings, distributable, carriesIn, minPayout);
  log(`epoch ${epochId}: ${holdings.length} girls, ${new Set(holdings.map((h) => h.wallet)).size} holders, total milk ${plan.totalMilk}, ${plan.payouts.length} payouts, ${plan.carries.size} carried`);

  await db.$transaction(
    async (tx) => {
      for (const c of ownerChanges) await tx.mint.update({ where: { assetId: c.assetId }, data: { owner: c.owner } });
      // Re-planning after a crash in "computing" starts clean.
      await tx.share.deleteMany({ where: { epochId } });
      await tx.payout.deleteMany({ where: { epochId } });
      if (plan.shares.length) {
        await tx.share.createMany({ data: plan.shares.map((s) => ({ epochId, assetId: s.assetId, wallet: s.wallet, milkRate: s.milkRate, amount: s.amount })) });
      }
      if (plan.payouts.length) {
        await tx.payout.createMany({
          data: plan.payouts.map((p) => ({ epochId, wallet: p.wallet, amount: p.amount, milk: p.milk, asset, decimals, status: dryRun ? "dry_run" : "pending" })),
        });
      }
      if (!dryRun) {
        await tx.carry.deleteMany({ where: { asset } });
        if (plan.carries.size) await tx.carry.createMany({ data: [...plan.carries].map(([wallet, amount]) => ({ wallet, amount, asset })) });
      }
      await tx.epoch.update({
        where: { id: epochId },
        data: {
          status: dryRun ? "computing" : "paying",
          poolAmount: distributable,
          carryIn: carryTotal,
          totalMilk: plan.totalMilk,
          girls: holdings.length,
          holders: new Set(holdings.map((h) => h.wallet)).size,
        },
      });
      await writeStatPoint(tx, distributable);
    },
    { timeout: 60_000 },
  );
}

async function poolBalance(asset: string): Promise<bigint> {
  const owner = new PublicKey(requireEnv("POOL_WALLET"));
  const connection = getConnection();
  if (asset === "SOL") return BigInt(await connection.getBalance(owner, "confirmed"));
  const { mint, programId } = await getMintInfo(requireEnv("PAYOUT_TOKEN_MINT"));
  const ata = getAssociatedTokenAddressSync(mint, owner, true, programId);
  try {
    return BigInt((await connection.getTokenAccountBalance(ata, "confirmed")).value.amount);
  } catch {
    return 0n;
  }
}

/**
 * Sends every pending payout of an epoch. Returns true once nothing is left to send.
 * Each batch's signature and last valid block height are saved before broadcast.
 */
async function sendPlanned(epochId: number, pool: Keypair, started: number, log: (m: string) => void): Promise<boolean> {
  const db = requireDb();
  const connection = getConnection();

  // First settle batches whose fate is unknown from an earlier run.
  const inFlight = await db.payout.findMany({ where: { epochId, status: "sending" } });
  if (inFlight.length) {
    const sigs = [...new Set(inFlight.map((p) => p.txSig!))];
    const statuses = (await connection.getSignatureStatuses(sigs, { searchTransactionHistory: true })).value;
    const height = await connection.getBlockHeight("confirmed");
    for (const [i, sig] of sigs.entries()) {
      const s = statuses[i];
      const rows = inFlight.filter((p) => p.txSig === sig);
      const expired = rows.every((p) => p.lastValidBlockHeight !== null && height > Number(p.lastValidBlockHeight));
      if (s && !s.err && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
        await db.payout.updateMany({ where: { txSig: sig, status: "sending" }, data: { status: "sent", sentAt: new Date() } });
      } else if (s?.err || (!s && expired)) {
        await db.payout.updateMany({ where: { txSig: sig, status: "sending" }, data: { status: "pending", txSig: null, lastValidBlockHeight: null, error: s?.err ? JSON.stringify(s.err) : "expired" } });
      } else {
        log(`epoch ${epochId}: batch ${sig} still unresolved, will retry next run`);
        return false;
      }
    }
  }

  const ep = await db.epoch.findUniqueOrThrow({ where: { id: epochId } });
  const isSol = ep.asset === "SOL";
  const pending = await db.payout.findMany({ where: { epochId, status: "pending" }, orderBy: { wallet: "asc" } });
  const token = isSol ? null : await getMintInfo(requireEnv("PAYOUT_TOKEN_MINT"));

  for (const batch of chunk(pending, isSol ? SOL_BATCH : TOKEN_BATCH)) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      log(`epoch ${epochId}: time budget reached, resuming next run`);
      return false;
    }
    await renewLock(epochId);

    const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitLimit({ units: isSol ? 20_000 + 600 * batch.length : 40_000 * batch.length })];
    for (const p of batch) {
      const to = new PublicKey(p.wallet);
      if (isSol) {
        ixs.push(SystemProgram.transfer({ fromPubkey: pool.publicKey, toPubkey: to, lamports: p.amount }));
      } else {
        const fromAta = getAssociatedTokenAddressSync(token!.mint, pool.publicKey, true, token!.programId);
        const toAta = getAssociatedTokenAddressSync(token!.mint, to, true, token!.programId);
        ixs.push(createAssociatedTokenAccountIdempotentInstruction(pool.publicKey, toAta, to, token!.mint, token!.programId));
        ixs.push(createTransferCheckedInstruction(fromAta, token!.mint, toAta, pool.publicKey, p.amount, token!.decimals, [], token!.programId));
      }
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: pool.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
    tx.sign(pool);
    const sig = bs58.encode(tx.signature!);
    const ids = batch.map((p) => p.id);

    // Recorded before broadcast: if we crash after this line, the resume step above settles it.
    await db.payout.updateMany({ where: { id: { in: ids }, status: "pending" }, data: { status: "sending", txSig: sig, lastValidBlockHeight: BigInt(lastValidBlockHeight) } });

    try {
      await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
      const res = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (res.value.err) throw new TxFailed(JSON.stringify(res.value.err));
      await db.payout.updateMany({ where: { id: { in: ids } }, data: { status: "sent", sentAt: new Date(), error: null } });
      log(`epoch ${epochId}: sent batch of ${batch.length} (${sig})`);
    } catch (err) {
      const definite = err instanceof TxFailed || /block height exceeded|simulation failed|insufficient/i.test(errText(err));
      if (definite) {
        // The transaction cannot land, so the batch is safe to retry.
        await db.payout.updateMany({
          where: { id: { in: ids } },
          data: { status: "pending", txSig: null, lastValidBlockHeight: null, error: errText(err).slice(0, 500), attempts: { increment: 1 } },
        });
        await giveUpOnRepeatFailures(epochId, ep.asset);
        log(`epoch ${epochId}: batch failed, will retry: ${errText(err)}`);
      } else {
        log(`epoch ${epochId}: batch ${sig} outcome unknown, will check next run: ${errText(err)}`);
      }
      return false;
    }
  }

  const left = await db.payout.count({ where: { epochId, status: { in: ["pending", "sending"] } } });
  if (left > 0) return false;
  await db.$transaction(async (tx) => {
    await tx.epoch.update({ where: { id: epochId }, data: { status: "complete", finishedAt: new Date(), lockedUntil: null } });
    await writeStatPoint(tx, ep.poolAmount);
  });
  return true;
}

/** Payouts that keep failing are moved into the wallet's carry, so the amount is paid later, never lost. */
async function giveUpOnRepeatFailures(epochId: number, asset: string) {
  const db = requireDb();
  const stuck = await db.payout.findMany({ where: { epochId, status: "pending", attempts: { gte: MAX_ATTEMPTS } } });
  for (const p of stuck) {
    await db.$transaction([
      db.payout.update({ where: { id: p.id }, data: { status: "failed" } }),
      db.carry.upsert({ where: { wallet: p.wallet }, create: { wallet: p.wallet, amount: p.amount, asset }, update: { amount: { increment: p.amount } } }),
    ]);
  }
}

class TxFailed extends Error {}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ------------------------------------------------------------------------------------------------
 * PAYOUT_ASSET=AMC_TOKENIZED
 *
 * LEGAL WARNING: This path buys tokenized AMC Entertainment stock (for example Backpack's $AMC or
 * xStocks' AMCx on Solana) with the pool and distributes it to holders. Tokenized stocks are
 * geo-restricted (not available to US persons, among others) and distributing them to anonymous
 * wallets could make this a securities offering. It is OFF by default and must not be enabled
 * without a written legal review. On mainnet it refuses to run unless
 * TOKENIZED_PAYOUTS_LEGAL_REVIEWED=true is also set.
 * ---------------------------------------------------------------------------------------------- */

function assertTokenizedAllowed(dryRun: boolean) {
  if (!env().PAYOUT_TOKEN_MINT) throw new ConfigError("PAYOUT_ASSET=AMC_TOKENIZED needs PAYOUT_TOKEN_MINT");
  if (CLUSTER === "mainnet-beta" && !dryRun && process.env.TOKENIZED_PAYOUTS_LEGAL_REVIEWED !== "true") {
    throw new ConfigError("Tokenized stock payouts need legal review before they run on mainnet. See the README.");
  }
}

const WSOL = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag/swap/v1";

/** Swaps the pool's spare SOL into the payout token through Jupiter. Mainnet only. */
async function swapPoolToPayoutToken(log: (m: string) => void) {
  if (CLUSTER !== "mainnet-beta") {
    log("tokenized payouts: Jupiter swaps only work on mainnet, skipping the swap");
    return;
  }
  const pool = poolKeypair();
  const connection = getConnection();
  const reserve = BigInt(Math.round(env().GAS_RESERVE_SOL * LAMPORTS_PER_SOL));
  const lamports = BigInt(await connection.getBalance(pool.publicKey, "confirmed")) - reserve;
  if (lamports <= 0n) return;

  const quoteUrl = `${JUP}/quote?inputMint=${WSOL}&outputMint=${requireEnv("PAYOUT_TOKEN_MINT")}&amount=${lamports}&slippageBps=100`;
  const quote = await (await fetch(quoteUrl, { cache: "no-store" })).json();
  const swapRes = await fetch(`${JUP}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: pool.publicKey.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true }),
  });
  const { swapTransaction } = (await swapRes.json()) as { swapTransaction?: string };
  if (!swapTransaction) throw new Error("Jupiter returned no swap transaction");
  const vtx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  vtx.sign([pool]);
  const sig = await connection.sendRawTransaction(vtx.serialize(), { maxRetries: 3 });
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  log(`tokenized payouts: swapped ${lamports} lamports (${sig})`);
}

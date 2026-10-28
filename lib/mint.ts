import "server-only";
import { createHash } from "node:crypto";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createNoopSigner, createSignerFromKeypair, publicKey as umiPk } from "@metaplex-foundation/umi";
import { createV1, safeFetchAssetV1, updateV1 } from "@metaplex-foundation/mpl-core";
import { fromWeb3JsKeypair, toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import bs58 from "bs58";
import { requireDb } from "./db";
import { ConfigError, env } from "./env";
import { COLLECTION_ADDRESS, SITE_URL } from "./config";
import { amcMintInfo, collectionAuthority, getConnection } from "./solana";
import { getUmi, umiAs } from "./umi";
import { newSeed, resolveRoll, verifyCommit } from "./fairness";
import { displayName, getRow, getSeries } from "./girls";
import { UserError } from "./api";
import type { PendingMint } from "./generated/prisma/client";

/** On-chain name before the reveal. The real name is written after the mint confirms. */
export const SEALED_NAME = "Sealed AMC girl";
const COMMIT_TTL_MS = 10 * 60_000;
const PENDING_TTL_MS = 120_000;
/** Rent for a Core asset plus fees, with headroom. */
const MIN_SOL_LAMPORTS = Math.round(0.006 * LAMPORTS_PER_SOL);

function collectionKey(): PublicKey {
  if (!COLLECTION_ADDRESS) throw new ConfigError("NEXT_PUBLIC_COLLECTION_ADDRESS is not set");
  return new PublicKey(COLLECTION_ADDRESS);
}

export function metadataUri(assetId: string): string {
  return `${SITE_URL}/api/metadata/${assetId}`;
}

function hashMessage(tx: Transaction): string {
  return createHash("sha256").update(tx.serializeMessage()).digest("hex");
}

async function costBaseUnits(): Promise<{ amount: bigint; decimals: number }> {
  const { decimals } = await amcMintInfo();
  return { amount: BigInt(env().MINT_COST_AMC) * 10n ** BigInt(decimals), decimals };
}

/** Step 1: publish sha256(seed) for this wallet before anything is signed. */
export async function createCommit(wallet: string) {
  const db = requireDb();
  const { seed, commit } = newSeed();
  const row = await db.seedCommit.create({ data: { wallet, seed, commit, expiresAt: new Date(Date.now() + COMMIT_TTL_MS) } });
  return { commitId: row.id, commit: row.commit, expiresAt: row.expiresAt.toISOString() };
}

/** The user's $AMC balance in base units, or 0 if they have no token account. */
export async function amcBalance(wallet: string): Promise<{ amount: bigint; decimals: number }> {
  const { mint, decimals, programId } = await amcMintInfo();
  const ata = getAssociatedTokenAddressSync(mint, new PublicKey(wallet), false, programId);
  try {
    const bal = await getConnection().getTokenAccountBalance(ata, "confirmed");
    return { amount: BigInt(bal.value.amount), decimals };
  } catch {
    return { amount: 0n, decimals };
  }
}

/**
 * Step 2: roll the girl, reserve her serial and build one transaction that burns $AMC and
 * creates the Core asset. The collection authority and the new asset key sign here; the
 * user signs last. The on-chain name stays sealed so the result can't be read before signing.
 */
export async function prepareMint(wallet: string, commitId: string) {
  const db = requireDb();
  const collection = collectionKey();
  const authority = collectionAuthority();
  const { mint, programId } = await amcMintInfo();
  const { amount: cost, decimals } = await costBaseUnits();
  const owner = new PublicKey(wallet);
  const connection = getConnection();

  const commit = await db.seedCommit.findUnique({ where: { id: commitId } });
  if (!commit || commit.wallet !== wallet) throw new UserError("That seed commitment isn't for this wallet. Refresh and try again.", 400, "bad_commit");
  if (commit.used) throw new UserError("That seed commitment was already used. Refresh to get a new one.", 409, "commit_used");
  if (commit.expiresAt < new Date()) throw new UserError("The seed commitment expired. Refresh to get a new one.", 410, "commit_expired");

  const [{ amount: balance }, lamports] = await Promise.all([amcBalance(wallet), connection.getBalance(owner, "confirmed")]);
  if (balance < cost) {
    throw new UserError(`You need ${env().MINT_COST_AMC.toLocaleString("en-US")} $AMC to summon. This wallet holds less.`, 400, "insufficient_amc");
  }
  if (lamports < MIN_SOL_LAMPORTS) {
    throw new UserError("You need about 0.006 SOL for network fees and the NFT's storage. Add some SOL and try again.", 400, "insufficient_sol");
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const { roll, row } = resolveRoll(commit.seed, wallet, blockhash);

  const assetKp = Keypair.generate();
  const assetId = assetKp.publicKey.toBase58();
  const umi = getUmi();
  const createIxs = createV1(umi, {
    asset: createSignerFromKeypair(umi, fromWeb3JsKeypair(assetKp)),
    collection: umiPk(collection.toBase58()),
    authority: createNoopSigner(umiPk(authority.publicKey.toBase58())),
    payer: createNoopSigner(umiPk(wallet)),
    owner: umiPk(wallet),
    name: SEALED_NAME,
    uri: metadataUri(assetId),
  })
    .getInstructions()
    .map(toWeb3JsInstruction);

  const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }),
    createBurnCheckedInstruction(ata, mint, owner, cost, decimals, [], programId),
    ...createIxs,
  );
  tx.partialSign(authority, assetKp);

  const pendingData = {
    assetId,
    wallet,
    commitId,
    series: row.series.id,
    tier: row.tier.id,
    milkRate: row.milkRate,
    blockhash,
    lastValidBlockHeight: BigInt(lastValidBlockHeight),
    roll,
    messageHash: hashMessage(tx),
    expiresAt: new Date(Date.now() + PENDING_TTL_MS),
  };

  await reserveSerial(pendingData);

  return {
    assetId,
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    commit: commit.commit,
    expiresAt: pendingData.expiresAt.toISOString(),
  };
}

/** Lowest free serial in the series, reserved together with the pending mint. Retries on a race. */
async function reserveSerial(data: Omit<PendingMint, "serial" | "signature" | "createdAt" | "submittedAt">) {
  const db = requireDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // Unsigned reservations past their blockhash can never land, so their serials are free again.
        await tx.pendingMint.deleteMany({ where: { expiresAt: { lt: new Date() }, signature: null } });
        const claimed = await tx.seedCommit.updateMany({ where: { id: data.commitId, used: false }, data: { used: true } });
        if (claimed.count !== 1) throw new UserError("That seed commitment was already used. Refresh to get a new one.", 409, "commit_used");
        const [mints, pendings] = await Promise.all([
          tx.mint.findMany({ where: { series: data.series }, select: { serial: true } }),
          tx.pendingMint.findMany({ where: { series: data.series }, select: { serial: true } }),
        ]);
        const used = new Set([...mints, ...pendings].map((r) => r.serial));
        let serial = 1;
        while (used.has(serial)) serial++;
        return tx.pendingMint.create({ data: { ...data, serial } });
      });
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Could not reserve a serial");
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
}

/**
 * Step 3: the user returns the signed transaction. The server checks it is exactly the one it
 * built, submits it, waits for confirmation, verifies the burn and the asset on chain, and only
 * then records the mint. Safe to call again with the same transaction.
 */
export async function confirmMint(assetId: string, signedTxBase64: string) {
  const db = requireDb();

  const existing = await db.mint.findUnique({ where: { assetId } });
  if (existing) return existing;

  const pending = await db.pendingMint.findUnique({ where: { assetId } });
  if (!pending) throw new UserError("This mint expired or was never started. Nothing was charged. Start a new summon.", 404, "unknown_mint");

  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(signedTxBase64, "base64"));
  } catch {
    throw new UserError("The signed transaction could not be read.", 400, "bad_tx");
  }
  if (hashMessage(tx) !== pending.messageHash) throw new UserError("The signed transaction doesn't match the one we built.", 400, "tx_mismatch");
  if (!tx.feePayer?.equals(new PublicKey(pending.wallet))) throw new UserError("The transaction was signed by a different wallet.", 400, "wrong_signer");
  if (!tx.verifySignatures(true)) throw new UserError("The transaction is missing a valid wallet signature.", 400, "bad_signature");

  const signature = bs58.encode(tx.signature!);
  const connection = getConnection();

  if (!pending.signature) {
    if (pending.expiresAt < new Date(Date.now() - 30_000)) {
      throw new UserError("This summon took too long and expired. Nothing was charged. Start a new one.", 410, "expired");
    }
    await db.pendingMint.update({ where: { assetId }, data: { signature, submittedAt: new Date() } });
  }

  try {
    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 5 });
  } catch (err) {
    // Already processed is fine on a retry. Anything else means it never landed.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already been processed/i.test(msg)) {
      await db.pendingMint.update({ where: { assetId }, data: { signature: null, submittedAt: null } });
      throw new UserError(friendlySendError(msg), 400, "send_failed");
    }
  }

  const result = await connection.confirmTransaction(
    { signature, blockhash: pending.blockhash, lastValidBlockHeight: Number(pending.lastValidBlockHeight) },
    "confirmed",
  );
  if (result.value.err) {
    await db.pendingMint.delete({ where: { assetId } }).catch(() => {});
    throw new UserError("The transaction failed on chain. No $AMC was burned. Try again.", 400, "tx_failed");
  }

  return finalizeMint(pending, signature);
}

function friendlySendError(msg: string): string {
  if (/insufficient (funds|lamports)/i.test(msg)) return "Not enough SOL to pay the network fee. Nothing was charged.";
  if (/blockhash not found|block height exceeded/i.test(msg)) return "The transaction expired before it reached the network. Nothing was charged. Start a new summon.";
  if (/0x1\b|insufficient/i.test(msg)) return "Your $AMC balance is too low for this burn. Nothing was charged.";
  return "The network rejected the transaction. Nothing was charged. Try again.";
}

type ParsedIx = ParsedInstruction | PartiallyDecodedInstruction;

/** Checks the confirmed transaction burned the right amount and created the asset, then records it. */
export async function finalizeMint(pending: PendingMint, signature: string) {
  const db = requireDb();
  const connection = getConnection();
  const { mint: amcMint } = await amcMintInfo();
  const { amount: cost } = await costBaseUnits();

  const parsed = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!parsed || parsed.meta?.err) throw new UserError("The transaction isn't confirmed yet. Try again in a few seconds.", 409, "not_confirmed");

  const burns = (parsed.transaction.message.instructions as ParsedIx[]).filter(
    (ix): ix is ParsedInstruction =>
      "parsed" in ix && (ix.program === "spl-token" || ix.program === "spl-token-2022") && ["burn", "burnChecked"].includes(ix.parsed?.type),
  );
  const burned = burns.reduce((sum, ix) => {
    const info = ix.parsed.info as { mint: string; authority?: string; multisigAuthority?: string; amount?: string; tokenAmount?: { amount: string } };
    if (info.mint !== amcMint.toBase58() || info.authority !== pending.wallet) return sum;
    return sum + BigInt(info.tokenAmount?.amount ?? info.amount ?? "0");
  }, 0n);
  if (burned !== cost) throw new Error(`Burn check failed for ${pending.assetId}: burned ${burned}, expected ${cost}`);

  const asset = await safeFetchAssetV1(getUmi(), umiPk(pending.assetId), { commitment: "confirmed" });
  if (!asset) throw new Error(`Asset ${pending.assetId} not found after confirmation`);
  if (asset.owner.toString() !== pending.wallet) throw new Error(`Asset ${pending.assetId} has the wrong owner`);
  if (asset.updateAuthority.type !== "Collection" || asset.updateAuthority.address?.toString() !== COLLECTION_ADDRESS) {
    throw new Error(`Asset ${pending.assetId} is not in the collection`);
  }

  const commit = await db.seedCommit.findUniqueOrThrow({ where: { id: pending.commitId } });
  if (!verifyCommit(commit.seed, commit.commit)) throw new Error("Seed does not match its commitment");
  // The roll must be reproducible from public inputs.
  const check = resolveRoll(commit.seed, pending.wallet, pending.blockhash);
  if (check.row.series.id !== pending.series || check.row.tier.id !== pending.tier) throw new Error("Roll does not reproduce");

  const created = await db.$transaction(async (tx) => {
    const already = await tx.mint.findUnique({ where: { assetId: pending.assetId } });
    if (already) return already;
    const m = await tx.mint.create({
      data: {
        assetId: pending.assetId,
        owner: pending.wallet,
        minter: pending.wallet,
        series: pending.series,
        tier: pending.tier,
        serial: pending.serial,
        milkRate: pending.milkRate,
        burnTx: signature,
        burnAmount: burned,
        seedCommit: commit.commit,
        seedReveal: commit.seed,
        blockhash: pending.blockhash,
        roll: pending.roll,
      },
    });
    await tx.pendingMint.delete({ where: { assetId: pending.assetId } });
    await writeStatPoint(tx);
    return m;
  });

  await revealOnChain(created.assetId, created.series, created.serial);
  return created;
}

/** Writes the real name to the asset. Best effort: the metadata JSON already carries it. */
export async function revealOnChain(assetId: string, seriesId: string, serial: number): Promise<boolean> {
  const series = getSeries(seriesId);
  if (!series) return false;
  try {
    const authority = collectionAuthority();
    const umi = umiAs(authority);
    await updateV1(umi, {
      asset: umiPk(assetId),
      collection: umiPk(COLLECTION_ADDRESS),
      newName: displayName(series, serial),
      newUri: metadataUri(assetId),
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
    return true;
  } catch (err) {
    console.error("[mint] reveal rename failed for", assetId, err instanceof Error ? err.message : err);
    return false;
  }
}

type Tx = Parameters<Parameters<ReturnType<typeof requireDb>["$transaction"]>[0]>[0];

/** Appends a chart point with current totals. */
export async function writeStatPoint(tx: Tx, pool = 0n) {
  const [agg, paid, last] = await Promise.all([
    tx.mint.aggregate({ _sum: { milkRate: true, burnAmount: true }, _count: true }),
    tx.payout.aggregate({ _sum: { amount: true }, where: { status: "sent", asset: "SOL" } }),
    tx.statPoint.findFirst({ orderBy: { timestamp: "desc" }, select: { pool: true } }),
  ]);
  await tx.statPoint.create({
    data: {
      totalMilk: BigInt(agg._sum.milkRate ?? 0),
      girls: agg._count,
      burned: agg._sum.burnAmount ?? 0n,
      paidOut: paid._sum.amount ?? 0n,
      pool: pool || last?.pool || 0n,
    },
  });
}

/**
 * Recovers mints whose transaction was submitted but never recorded (for example the request
 * died mid-confirm). Run from the cron route.
 */
export async function reconcilePendingMints(): Promise<{ finalized: number; dropped: number }> {
  const db = requireDb();
  const connection = getConnection();
  const stale = await db.pendingMint.findMany({ where: { signature: { not: null }, submittedAt: { lt: new Date(Date.now() - 60_000) } }, take: 50 });
  let finalized = 0;
  let dropped = 0;
  if (stale.length === 0) return { finalized, dropped };
  const height = await connection.getBlockHeight("confirmed");
  const statuses = await connection.getSignatureStatuses(stale.map((p) => p.signature!), { searchTransactionHistory: true });
  for (const [i, p] of stale.entries()) {
    const s = statuses.value[i];
    try {
      if (s && !s.err && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
        await finalizeMint(p, p.signature!);
        finalized++;
      } else if ((s?.err || !s) && height > Number(p.lastValidBlockHeight)) {
        await db.pendingMint.delete({ where: { assetId: p.assetId } });
        dropped++;
      }
    } catch (err) {
      console.error("[mint] reconcile", p.assetId, err instanceof Error ? err.message : err);
    }
  }
  return { finalized, dropped };
}

export function rowFor(seriesId: string, tierId: string) {
  const row = getRow(seriesId, tierId);
  if (!row) throw new Error(`Unknown girl ${seriesId}:${tierId}`);
  return row;
}

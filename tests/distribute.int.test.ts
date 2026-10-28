/**
 * Integration test for the distribution worker against a real Postgres, with the chain faked.
 * Checks that crashes mid-payout resume without paying anyone twice.
 *
 * Runs only when TEST_DATABASE_URL is set, and wipes that database. Never point it at real data:
 *   TEST_DATABASE_URL=postgresql://amc:amc@localhost:54329/amc_test npm test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Keypair, SystemInstruction, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

const url = process.env.TEST_DATABASE_URL;
const pool = Keypair.generate();

// ---- Fake chain -------------------------------------------------------------------------------
type Mode = "ok" | "landed_but_lost" | "lost_before_landing";
const chain = {
  height: 1_000,
  poolLamports: 10_000_000_000n,
  landed: new Set<string>(),
  received: new Map<string, bigint>(),
  nextSend: [] as Mode[],
  holders: [] as { assetId: string; owner: string; burnt: boolean }[],
};

function land(raw: Buffer) {
  const tx = Transaction.from(raw);
  const sig = bs58.encode(tx.signature!);
  if (chain.landed.has(sig)) return sig;
  for (const ix of tx.instructions) {
    if (!ix.programId.equals(SystemProgram.programId)) continue;
    const { toPubkey, lamports } = SystemInstruction.decodeTransfer(ix);
    const to = toPubkey.toBase58();
    chain.received.set(to, (chain.received.get(to) ?? 0n) + BigInt(lamports));
    chain.poolLamports -= BigInt(lamports);
  }
  chain.landed.add(sig);
  return sig;
}

const fakeConnection = {
  getBalance: async () => Number(chain.poolLamports),
  getBlockHeight: async () => chain.height,
  getLatestBlockhash: async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: chain.height + 150 }),
  sendRawTransaction: async (raw: Buffer) => {
    const mode = chain.nextSend.shift() ?? "ok";
    if (mode === "lost_before_landing") throw new Error("fetch failed: socket hang up");
    const sig = land(raw);
    if (mode === "landed_but_lost") throw new Error("fetch failed: socket hang up");
    return sig;
  },
  confirmTransaction: async () => ({ value: { err: null } }),
  getSignatureStatuses: async (sigs: string[]) => ({
    value: sigs.map((s) => (chain.landed.has(s) ? { confirmationStatus: "confirmed", err: null } : null)),
  }),
};

vi.mock("@/lib/solana", () => ({
  getConnection: () => fakeConnection,
  poolKeypair: () => pool,
  getMintInfo: async () => {
    throw new Error("not used for SOL payouts");
  },
}));
vi.mock("@/lib/das", () => ({ snapshotCollection: async () => chain.holders }));
vi.mock("@/lib/mint", () => ({
  reconcilePendingMints: async () => ({ finalized: 0, dropped: 0 }),
  writeStatPoint: async () => {},
}));

// ---- Test -------------------------------------------------------------------------------------
describe.skipIf(!url)("distribution worker", () => {
  let mod: typeof import("@/lib/distribute");
  let db: import("@/lib/generated/prisma/client").PrismaClient;
  const T0 = Date.UTC(2030, 0, 1);

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: url,
      DISTRIBUTIONS_ENABLED: "true",
      DRY_RUN: "false",
      PAYOUT_ASSET: "SOL",
      MIN_PAYOUT: "0.001",
      GAS_RESERVE_SOL: "0.05",
      POOL_WALLET: pool.publicKey.toBase58(),
      POOL_WALLET_SECRET: JSON.stringify(Array.from(pool.secretKey)),
      NEXT_PUBLIC_COLLECTION_ADDRESS: Keypair.generate().publicKey.toBase58(),
    });
    mod = await import("@/lib/distribute");
    db = (await import("@/lib/db")).requireDb();
    await db.$executeRawUnsafe(
      'TRUNCATE "Share", "Payout", "Epoch", "Carry", "Mint", "PendingMint", "SeedCommit", "StatPoint", "RateLimit", "Setting" CASCADE',
    );

    // 25 girls across 22 wallets: two batches of payouts. One whale holds four.
    const wallets = Array.from({ length: 22 }, () => Keypair.generate().publicKey.toBase58());
    for (let i = 0; i < 25; i++) {
      const assetId = Keypair.generate().publicKey.toBase58();
      const owner = i < 4 ? wallets[0]! : wallets[i - 3]!;
      await db.mint.create({
        data: {
          assetId, owner, minter: owner, series: "trader", tier: "devoted", serial: i + 1, milkRate: 12_000 + i * 1_000,
          burnTx: `tx${i}`, burnAmount: 100_000_000_000n, seedCommit: "c", seedReveal: "s", blockhash: "b", roll: "r",
        },
      });
      chain.holders.push({ assetId, owner, burnt: false });
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function paidPerWallet(epochId: number) {
    const rows = await db.payout.findMany({ where: { epochId } });
    return new Map(rows.map((r) => [r.wallet, { amount: r.amount, status: r.status }]));
  }

  it("resumes a batch that landed but whose response was lost, without re-sending it", async () => {
    chain.nextSend = ["landed_but_lost"];
    const first = await mod.runDistribution({ now: T0 });
    expect(first.status).toBe("paying");

    // The lock is still held by the crashed run; expire it as time would.
    await db.epoch.updateMany({ data: { lockedUntil: new Date(0) } });
    const second = await mod.runDistribution({ now: T0 });
    expect(second.status).toBe("complete");

    const planned = await paidPerWallet(mod.epochIdFor(T0));
    expect(planned.size).toBe(22);
    for (const [wallet, p] of planned) {
      expect(p.status).toBe("sent");
      expect(chain.received.get(wallet)).toBe(p.amount);
    }
    const total = [...planned.values()].reduce((s, p) => s + p.amount, 0n);
    expect(total).toBeLessThanOrEqual(10_000_000_000n - 50_000_000n);
  });

  it("re-sends a lost batch only after its blockhash has expired", async () => {
    const before = new Map(chain.received);
    const T1 = T0 + 600_000;
    chain.poolLamports += 5_000_000_000n; // new creator fees
    chain.nextSend = ["lost_before_landing"];
    expect((await mod.runDistribution({ now: T1 })).status).toBe("paying");

    // Blockhash still valid: the batch might yet land, so the worker must wait.
    await db.epoch.updateMany({ data: { lockedUntil: new Date(0) } });
    const waiting = await mod.runDistribution({ now: T1 });
    expect(waiting.status).toBe("paying");
    expect(await db.payout.count({ where: { epochId: mod.epochIdFor(T1), status: "sending" } })).toBeGreaterThan(0);

    chain.height += 1_000;
    await db.epoch.updateMany({ data: { lockedUntil: new Date(0) } });
    await mod.runDistribution({ now: T1 });

    const planned = await paidPerWallet(mod.epochIdFor(T1));
    for (const [wallet, p] of planned) {
      expect(p.status).toBe("sent");
      expect((chain.received.get(wallet) ?? 0n) - (before.get(wallet) ?? 0n)).toBe(p.amount);
    }
  });

  it("lets only one of two concurrent runs plan an epoch", async () => {
    const T2 = T0 + 1_200_000;
    chain.poolLamports += 1_000_000_000n;
    const results = await Promise.all([mod.runDistribution({ now: T2 }), mod.runDistribution({ now: T2 })]);
    expect(results.filter((r) => r.status === "complete")).toHaveLength(1);
    expect(await db.epoch.count({ where: { id: mod.epochIdFor(T2) } })).toBe(1);
    const rows = await db.payout.findMany({ where: { epochId: mod.epochIdFor(T2) } });
    expect(new Set(rows.map((r) => r.wallet)).size).toBe(rows.length);
  });

  it("does nothing while paused", async () => {
    await mod.setPaused(true);
    expect(await mod.runDistribution({ now: T0 + 1_800_000 })).toMatchObject({ status: "skipped", reason: "paused by admin" });
    await mod.setPaused(false);
  });
});

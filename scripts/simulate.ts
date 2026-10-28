/**
 * Mints N random girls on devnet through the real server mint path (commit, prepare, sign,
 * confirm), then runs one distribution epoch and prints the share table.
 *
 *   npm run simulate -- 6          mint 6 girls across 3 test wallets, then a dry-run epoch
 *   npm run simulate -- 0 --pay    no new mints, then a real devnet SOL payout epoch
 *
 * The devnet pool wallet (.keys/pool.json unless POOL_WALLET is set) is topped up to 0.3 SOL to
 * stand in for creator fees. --pay sends real devnet SOL instead of a dry run.
 * Devnet only. Needs DATABASE_URL, NEXT_PUBLIC_AMC_MINT (made by devnet:token, so the payer can
 * mint test $AMC), NEXT_PUBLIC_COLLECTION_ADDRESS and COLLECTION_AUTHORITY_SECRET.
 */
import { assertDevnet, connection, ensureSol, keyFile, keypair, setEnv } from "./_shared";
import { Transaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

const n = Number(process.argv[2] ?? 6);
const pay = process.argv.includes("--pay");

async function main() {
  assertDevnet();
  for (const k of ["DATABASE_URL", "NEXT_PUBLIC_AMC_MINT", "NEXT_PUBLIC_COLLECTION_ADDRESS", "COLLECTION_AUTHORITY_SECRET"]) {
    if (!process.env[k]) throw new Error(`${k} is not set. Run npm run devnet:token and npm run devnet:collection first.`);
  }
  const conn = connection();
  const payer = keypair("devnet-payer");

  if (!process.env.POOL_WALLET) {
    const pool = keypair("pool");
    setEnv("POOL_WALLET", pool.publicKey.toBase58());
    setEnv("POOL_WALLET_SECRET", keyFile("pool"));
  }
  const poolKey = new PublicKey(process.env.POOL_WALLET!);
  await ensureSol(conn, poolKey, 0.3, payer);
  console.log(`Pool ${poolKey.toBase58()} topped up to 0.3 SOL as stand-in creator fees`);

  // Server modules read env lazily, so import them after .env and the pool keys are in place.
  const { createCommit, prepareMint, confirmMint } = await import("../lib/mint");
  const { runDistribution, epochIdFor } = await import("../lib/distribute");
  const { requireDb } = await import("../lib/db");
  const { displayName, getSeries, getTier } = await import("../lib/girls");

  const amc = new PublicKey(process.env.NEXT_PUBLIC_AMC_MINT!);
  const decimals = (await getMint(conn, amc)).decimals;
  const cost = BigInt(process.env.MINT_COST_AMC || "100000");
  const wallets = [1, 2, 3].map((i) => keypair(`sim-wallet-${i}`));

  for (const [i, w] of wallets.entries()) {
    if (n === 0) break;
    await ensureSol(conn, w.publicKey, 0.05, payer);
    const ata = await getOrCreateAssociatedTokenAccount(conn, payer, amc, w.publicKey);
    const need = cost * BigInt(Math.ceil(n / wallets.length)) * 10n ** BigInt(decimals);
    if (ata.amount < need) await mintTo(conn, payer, amc, ata.address, payer, need - ata.amount);
    console.log(`Wallet ${i + 1}: ${w.publicKey.toBase58()}`);
  }

  for (let i = 0; i < n; i++) {
    const w = wallets[i % wallets.length]!;
    const wallet = w.publicKey.toBase58();
    const { commitId, commit } = await createCommit(wallet);
    const prep = await prepareMint(wallet, commitId);
    const tx = Transaction.from(Buffer.from(prep.transaction, "base64"));
    tx.partialSign(w);
    const m = await confirmMint(prep.assetId, tx.serialize().toString("base64"));
    console.log(`#${i + 1} ${displayName(getSeries(m.series)!, m.serial)} (${getTier(m.tier)!.name}, ${m.milkRate.toLocaleString("en-US")} mL/s) -> ${wallet.slice(0, 6)}  commit ${commit.slice(0, 12)}...  ${prep.assetId}`);
  }

  // Use the most recent window nobody has run, going back in time, so the live cron's
  // current and future windows stay untouched.
  const db = requireDb();
  let now = Date.now();
  while (await db.epoch.findUnique({ where: { id: epochIdFor(now) } })) now -= 600_000;

  const result = await runDistribution({ force: true, dryRun: !pay, now, log: (m) => console.log(`  ${m}`) });
  console.log(result);
  if (result.status === "skipped") return;

  const payouts = await db.payout.findMany({ where: { epochId: result.epochId }, orderBy: { amount: "desc" } });
  const totalMilk = Number(result.totalMilk) || 1;
  console.table(
    payouts.map((p) => ({
      wallet: p.wallet,
      milk: Number(p.milk).toLocaleString("en-US"),
      share: `${((Number(p.milk) / totalMilk) * 100).toFixed(2)}%`,
      amount_sol: (Number(p.amount) / 1e9).toFixed(6),
      status: p.status,
      tx: p.txSig ?? "",
    })),
  );
  const carries = await db.carry.findMany();
  if (carries.length) console.log("Carried dust:", carries.map((c) => `${c.wallet.slice(0, 6)}=${c.amount}`).join(", "));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

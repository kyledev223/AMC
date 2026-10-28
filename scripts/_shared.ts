import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

/** Shared helpers for the devnet scripts. Keys live in .keys/ (gitignored); secrets are never printed. */

export const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";

export function assertDevnet() {
  if (CLUSTER !== "devnet" && CLUSTER !== "localnet") {
    console.error(`Refusing to run: NEXT_PUBLIC_SOLANA_CLUSTER is "${CLUSTER}". These scripts are for devnet only.`);
    process.exit(1);
  }
}

export function rpcUrl(): string {
  if (process.env.HELIUS_API_KEY && CLUSTER === "devnet") return `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  return process.env.NEXT_PUBLIC_RPC_URL || (CLUSTER === "localnet" ? "http://127.0.0.1:8899" : "https://api.devnet.solana.com");
}

export const connection = () => new Connection(rpcUrl(), "confirmed");

const KEYS = resolve(process.cwd(), ".keys");

/** Loads .keys/<name>.json, creating a new keypair if it doesn't exist. */
export function keypair(name: string): Keypair {
  if (!existsSync(KEYS)) mkdirSync(KEYS, { recursive: true });
  const file = resolve(KEYS, `${name}.json`);
  if (existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8")) as number[]));
  const kp = Keypair.generate();
  writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`Created keypair .keys/${name}.json (${kp.publicKey.toBase58()})`);
  return kp;
}

export function keyFile(name: string): string {
  return readFileSync(resolve(KEYS, `${name}.json`), "utf8").trim();
}

/** Writes KEY=value into .env, replacing an existing line. Local dev convenience. */
export function setEnv(key: string, value: string) {
  const file = resolve(process.cwd(), ".env");
  const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.splice(lines.length && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length, 0, `${key}=${value}`);
  writeFileSync(file, lines.join("\n").replace(/\n*$/, "\n"));
  process.env[key] = value;
}

/** Makes sure a wallet has at least `sol` SOL: airdrop first, then fall back to the payer. */
export async function ensureSol(conn: Connection, who: PublicKey, sol: number, payer?: Keypair) {
  const want = Math.round(sol * LAMPORTS_PER_SOL);
  const have = await conn.getBalance(who);
  if (have >= want) return;
  if (payer && !payer.publicKey.equals(who)) {
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: who, lamports: want - have }));
    await sendAndConfirmTransaction(conn, tx, [payer]);
    return;
  }
  try {
    const sig = await conn.requestAirdrop(who, Math.min(2 * LAMPORTS_PER_SOL, want - have + LAMPORTS_PER_SOL));
    await conn.confirmTransaction({ signature: sig, ...(await conn.getLatestBlockhash()) }, "confirmed");
  } catch (err) {
    console.error(`Airdrop to ${who.toBase58()} failed: ${err instanceof Error ? err.message : err}`);
    console.error("The devnet RPC faucet is closed. Fund this address at https://faucet.solana.com (devnet), then run again.");
    process.exit(1);
  }
}

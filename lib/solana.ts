import "server-only";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";
import bs58 from "bs58";
import { AMC_MINT } from "./config";
import { ConfigError, requireEnv, serverRpcUrl } from "./env";

let connection: Connection | undefined;

export function getConnection(): Connection {
  connection ??= new Connection(serverRpcUrl(), { commitment: "confirmed" });
  return connection;
}

/** Accepts a base58 secret key or a JSON byte array (the solana-keygen file format). Never logged. */
export function parseSecretKey(secret: string, label: string): Keypair {
  try {
    const trimmed = secret.trim();
    const bytes = trimmed.startsWith("[") ? Uint8Array.from(JSON.parse(trimmed) as number[]) : bs58.decode(trimmed);
    return Keypair.fromSecretKey(bytes);
  } catch {
    throw new ConfigError(`${label} is not a valid secret key`);
  }
}

export function collectionAuthority(): Keypair {
  return parseSecretKey(requireEnv("COLLECTION_AUTHORITY_SECRET"), "COLLECTION_AUTHORITY_SECRET");
}

export function poolKeypair(): Keypair {
  const kp = parseSecretKey(requireEnv("POOL_WALLET_SECRET"), "POOL_WALLET_SECRET");
  const expected = requireEnv("POOL_WALLET");
  if (kp.publicKey.toBase58() !== expected) throw new ConfigError("POOL_WALLET_SECRET does not match POOL_WALLET");
  return kp;
}

export type MintInfo = { mint: PublicKey; decimals: number; programId: PublicKey };

const mintCache = new Map<string, MintInfo>();

/** Decimals and owning token program (classic SPL or Token-2022) for a mint. Cached per process. */
export async function getMintInfo(address: string): Promise<MintInfo> {
  const hit = mintCache.get(address);
  if (hit) return hit;
  const mint = new PublicKey(address);
  const account = await getConnection().getAccountInfo(mint);
  if (!account) throw new ConfigError(`Mint ${address} not found on this cluster`);
  const programId = account.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const info = await getMint(getConnection(), mint, "confirmed", programId);
  const out = { mint, decimals: info.decimals, programId };
  mintCache.set(address, out);
  return out;
}

export async function amcMintInfo(): Promise<MintInfo> {
  if (!AMC_MINT) throw new ConfigError("NEXT_PUBLIC_AMC_MINT is not set");
  return getMintInfo(AMC_MINT);
}

/** $AMC decimals for display. Falls back to 6 (the pump.fun default) when the chain can't be reached. */
export async function amcDecimals(): Promise<number> {
  try {
    return (await amcMintInfo()).decimals;
  } catch {
    return 6;
  }
}

import "server-only";
import { z } from "zod";
import { CLUSTER } from "./config";

/**
 * Server-only configuration. Secrets are read here and nowhere else, and are never logged.
 * Parsing is lazy so pages that don't touch the chain or the database still render
 * when those variables are missing.
 */

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : v.toLowerCase() === "true"));

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  HELIUS_API_KEY: z.string().optional(),
  COLLECTION_AUTHORITY_SECRET: z.string().optional(),
  POOL_WALLET: z.string().optional(),
  POOL_WALLET_SECRET: z.string().optional(),
  MINT_COST_AMC: z.coerce.number().int().positive().default(100_000),
  PAYOUT_ASSET: z.enum(["SOL", "AMC_TOKENIZED"]).default("SOL"),
  PAYOUT_TOKEN_MINT: z.string().optional(),
  MIN_PAYOUT: z.coerce.number().nonnegative().default(0.001),
  GAS_RESERVE_SOL: z.coerce.number().nonnegative().default(0.05),
  DISTRIBUTIONS_ENABLED: bool(false),
  DRY_RUN: bool(true),
  CRON_SECRET: z.string().optional(),
  ADMIN_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (!cached) {
    const blanksRemoved = Object.fromEntries(
      Object.keys(schema.shape).map((k) => [k, process.env[k] === "" ? undefined : process.env[k]]),
    );
    cached = schema.parse(blanksRemoved);
  }
  return cached;
}

export function requireEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const v = env()[key];
  if (v === undefined || v === null || v === "") throw new ConfigError(`${String(key)} is not set`);
  return v as NonNullable<ServerEnv[K]>;
}

export class ConfigError extends Error {
  readonly name = "ConfigError";
}

/** Server RPC: Helius when a key is set, otherwise the public endpoint. */
export function serverRpcUrl(): string {
  const key = env().HELIUS_API_KEY;
  if (key && CLUSTER !== "localnet") {
    return `https://${CLUSTER === "mainnet-beta" ? "mainnet" : "devnet"}.helius-rpc.com/?api-key=${key}`;
  }
  return process.env.NEXT_PUBLIC_RPC_URL || (CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : CLUSTER === "localnet" ? "http://127.0.0.1:8899" : "https://api.devnet.solana.com");
}

export function hasDatabase(): boolean {
  return Boolean(env().DATABASE_URL);
}

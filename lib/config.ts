/**
 * Public, client-safe configuration. NEXT_PUBLIC_* values are inlined at build time,
 * so each one is read by its full name.
 */

export type Cluster = "devnet" | "mainnet-beta" | "localnet";

function parseCluster(v: string | undefined): Cluster {
  // Never default to mainnet. Anything unrecognised falls back to devnet.
  if (v === "mainnet-beta" || v === "localnet") return v;
  return "devnet";
}

export const CLUSTER: Cluster = parseCluster(process.env.NEXT_PUBLIC_SOLANA_CLUSTER);

const DEFAULT_RPC: Record<Cluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

export const PUBLIC_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC[CLUSTER];
export const AMC_MINT = process.env.NEXT_PUBLIC_AMC_MINT ?? "";
export const COLLECTION_ADDRESS = process.env.NEXT_PUBLIC_COLLECTION_ADDRESS ?? "";
export const X_HANDLE = "animemilkercult";
export const X_URL = `https://x.com/${X_HANDLE}`;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Seconds between distributions. */
export const EPOCH_SECONDS = 600;

export function solscan(kind: "tx" | "account" | "token", id: string): string {
  const q = CLUSTER === "mainnet-beta" ? "" : CLUSTER === "devnet" ? "?cluster=devnet" : "?cluster=custom";
  return `https://solscan.io/${kind}/${id}${q}`;
}

export function shortAddress(a: string, n = 4): string {
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

/** Display helpers. Amounts arrive as base-unit strings or bigints to keep precision. */

export function formatInt(n: number | bigint): string {
  return typeof n === "bigint" ? n.toLocaleString("en-US") : Math.round(n).toLocaleString("en-US");
}

/** mL/s, compacted above a million. */
export function formatMilk(mlPerSec: number | bigint): string {
  const n = Number(mlPerSec);
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M mL/s`;
  return `${formatInt(n)} mL/s`;
}

export function toUnits(base: bigint | string, decimals: number): number {
  const b = typeof base === "string" ? BigInt(base) : base;
  return Number(b) / 10 ** decimals;
}

/** Base units to a whole-number-friendly string, for example 1,234.5678 */
export function formatUnits(base: bigint | string, decimals: number, maxFraction = 4): string {
  const b = typeof base === "string" ? BigInt(base) : base;
  const negative = b < 0n;
  const abs = negative ? -b : b;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  let frac = (abs % scale).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  if (whole === 0n && frac === "" && abs > 0n) frac = "0".repeat(Math.max(0, maxFraction - 1)) + "1";
  const s = `${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
  return negative ? `-${s}` : s;
}

export function formatSol(lamports: bigint | string): string {
  return `${formatUnits(lamports, 9, 4)} SOL`;
}

export function formatCompact(n: number): string {
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
}

export function timeAgo(date: Date | string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC";
}

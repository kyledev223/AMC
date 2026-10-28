import { createHash, randomBytes } from "node:crypto";
import { ODDS_DENOMINATOR, rowForTicket, type OddsRow } from "./girls";

/**
 * Commit-reveal randomness.
 * 1. The server makes a secret seed and publishes commit = sha256(seed) before the user signs.
 * 2. The roll is sha256(seed + wallet + recentBlockhash), all as plain strings.
 * 3. The first 8 bytes of the roll, as an unsigned integer, mod 10,000 picks the row.
 * 4. After the mint confirms, the seed is shown on the girl's page so anyone can redo the math.
 */

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function newSeed(): { seed: string; commit: string } {
  const seed = randomBytes(32).toString("hex");
  return { seed, commit: sha256Hex(seed) };
}

export function rollFor(seed: string, wallet: string, blockhash: string): string {
  return sha256Hex(seed + wallet + blockhash);
}

export function ticketFromRoll(rollHex: string): number {
  return Number(BigInt(`0x${rollHex.slice(0, 16)}`) % BigInt(ODDS_DENOMINATOR));
}

export function resolveRoll(seed: string, wallet: string, blockhash: string): { roll: string; ticket: number; row: OddsRow } {
  const roll = rollFor(seed, wallet, blockhash);
  const ticket = ticketFromRoll(roll);
  return { roll, ticket, row: rowForTicket(ticket) };
}

export function verifyCommit(seed: string, commit: string): boolean {
  return sha256Hex(seed) === commit;
}

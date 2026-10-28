import { describe, expect, it } from "vitest";
import { newSeed, resolveRoll, sha256Hex, ticketFromRoll, verifyCommit } from "@/lib/fairness";

describe("commit-reveal", () => {
  it("commits to the seed", () => {
    const { seed, commit } = newSeed();
    expect(commit).toBe(sha256Hex(seed));
    expect(verifyCommit(seed, commit)).toBe(true);
    expect(verifyCommit(`${seed}0`, commit)).toBe(false);
  });

  it("is deterministic for the same inputs", () => {
    const seed = "ab".repeat(32);
    const a = resolveRoll(seed, "Wallet111", "Blockhash111");
    expect(resolveRoll(seed, "Wallet111", "Blockhash111")).toEqual(a);
    expect(a.roll).toBe(sha256Hex(`${seed}Wallet111Blockhash111`));
  });

  it("changes with the wallet", () => {
    const seed = "cd".repeat(32);
    expect(resolveRoll(seed, "WalletA", "Blockhash").roll).not.toBe(resolveRoll(seed, "WalletB", "Blockhash").roll);
  });

  it("reads the first 8 bytes mod 10,000", () => {
    expect(ticketFromRoll("0000000000002710ffff")).toBe(0);
    expect(ticketFromRoll("000000000000270f0000")).toBe(9_999);
  });
});

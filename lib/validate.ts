import { z } from "zod";
import { PublicKey } from "@solana/web3.js";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isPublicKey(v: string): boolean {
  if (!BASE58.test(v)) return false;
  try {
    return new PublicKey(v).toBytes().length === 32;
  } catch {
    return false;
  }
}

export const zPublicKey = z.string().trim().refine(isPublicKey, "Not a valid Solana address");
export const zSignature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/, "Not a valid transaction signature");
export const zBase64 = z.string().max(4096).regex(/^[A-Za-z0-9+/]+={0,2}$/, "Not valid base64");

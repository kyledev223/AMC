import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handleError, rateLimit } from "@/lib/api";
import { amcBalance } from "@/lib/mint";
import { zPublicKey } from "@/lib/validate";
import { hasDatabase } from "@/lib/env";

export const dynamic = "force-dynamic";

const query = z.object({ wallet: zPublicKey });

/** A wallet's $AMC balance, read on the server so it uses the private RPC. */
export async function GET(req: Request) {
  try {
    const { wallet } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    if (hasDatabase()) await rateLimit(`balance:ip:${clientIp(req)}`, 60, 60);
    const { amount, decimals } = await amcBalance(wallet);
    return NextResponse.json({ amount: amount.toString(), decimals });
  } catch (err) {
    return handleError(err, "balance");
  }
}

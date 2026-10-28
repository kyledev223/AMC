import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handleError, parseJson, rateLimit } from "@/lib/api";
import { createCommit } from "@/lib/mint";
import { zPublicKey } from "@/lib/validate";

export const dynamic = "force-dynamic";

const body = z.object({ wallet: zPublicKey });

/** Publishes sha256(seed) for the next mint from this wallet. */
export async function POST(req: Request) {
  try {
    const { wallet } = await parseJson(req, body);
    await rateLimit(`commit:ip:${clientIp(req)}`, 60, 60);
    await rateLimit(`commit:w:${wallet}`, 20, 60);
    return NextResponse.json(await createCommit(wallet));
  } catch (err) {
    return handleError(err, "mint/commit");
  }
}

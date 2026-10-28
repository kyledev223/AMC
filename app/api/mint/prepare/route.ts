import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handleError, parseJson, rateLimit } from "@/lib/api";
import { prepareMint } from "@/lib/mint";
import { zPublicKey } from "@/lib/validate";

export const dynamic = "force-dynamic";

const body = z.object({ wallet: zPublicKey, commitId: z.string().min(10).max(40) });

/** Builds the burn + mint transaction for the user to sign. */
export async function POST(req: Request) {
  try {
    const { wallet, commitId } = await parseJson(req, body);
    await rateLimit(`prepare:ip:${clientIp(req)}`, 20, 60);
    await rateLimit(`prepare:w:${wallet}`, 6, 60);
    return NextResponse.json(await prepareMint(wallet, commitId));
  } catch (err) {
    return handleError(err, "mint/prepare");
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handleError, parseJson, rateLimit } from "@/lib/api";
import { confirmMint } from "@/lib/mint";
import { getRow } from "@/lib/girls";
import { zBase64, zPublicKey } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ assetId: zPublicKey, transaction: zBase64 });

/** Submits the signed transaction, verifies it on chain and records the mint. */
export async function POST(req: Request) {
  try {
    const { assetId, transaction } = await parseJson(req, body);
    await rateLimit(`confirm:ip:${clientIp(req)}`, 30, 60);
    const m = await confirmMint(assetId, transaction);
    const row = getRow(m.series, m.tier);
    return NextResponse.json({
      assetId: m.assetId,
      series: m.series,
      tier: m.tier,
      serial: m.serial,
      milkRate: m.milkRate,
      odds: row?.percent ?? null,
      burnTx: m.burnTx,
      seedCommit: m.seedCommit,
      seedReveal: m.seedReveal,
    });
  } catch (err) {
    return handleError(err, "mint/confirm");
  }
}

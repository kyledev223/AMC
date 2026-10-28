import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handleError, rateLimit } from "@/lib/api";
import { assetsOwnedBy } from "@/lib/das";
import { getMintsByAssetIds, getMintsByOwner, getNetworkStats } from "@/lib/queries";
import { hasDatabase } from "@/lib/env";
import { zPublicKey } from "@/lib/validate";

export const dynamic = "force-dynamic";

const query = z.object({ owner: zPublicKey });

/** A wallet's girls. Ownership is read live from chain; falls back to the last snapshot. */
export async function GET(req: Request) {
  try {
    const { owner } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    if (hasDatabase()) await rateLimit(`girls:ip:${clientIp(req)}`, 60, 60);

    let source: "chain" | "snapshot" = "chain";
    let girls;
    try {
      girls = await getMintsByAssetIds(await assetsOwnedBy(owner));
    } catch (err) {
      console.error("[girls] chain lookup failed, using snapshot:", err instanceof Error ? err.message : err);
      source = "snapshot";
      girls = await getMintsByOwner(owner);
    }
    const stats = await getNetworkStats();
    return NextResponse.json({ girls, totalMilk: stats.totalMilk, source });
  } catch (err) {
    return handleError(err, "girls");
  }
}

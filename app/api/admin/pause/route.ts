import { NextResponse } from "next/server";
import { z } from "zod";
import { bearerOrHeader, handleError, jsonError, parseJson, secretMatches } from "@/lib/api";
import { env } from "@/lib/env";
import { isPausedSetting, setPaused } from "@/lib/distribute";

export const dynamic = "force-dynamic";

const body = z.object({ paused: z.boolean() });

function authorized(req: Request) {
  return secretMatches(bearerOrHeader(req, "x-admin-secret"), env().ADMIN_SECRET);
}

/** Current state of the distribution switches. */
export async function GET(req: Request) {
  if (!authorized(req)) return jsonError("Unauthorized", 401, "unauthorized");
  try {
    const e = env();
    return NextResponse.json({ paused: await isPausedSetting(), distributionsEnabled: e.DISTRIBUTIONS_ENABLED, dryRun: e.DRY_RUN, payoutAsset: e.PAYOUT_ASSET });
  } catch (err) {
    return handleError(err, "admin/pause");
  }
}

/** Pause or resume distributions without a redeploy. Body: {"paused": true} */
export async function POST(req: Request) {
  if (!authorized(req)) return jsonError("Unauthorized", 401, "unauthorized");
  try {
    const { paused } = await parseJson(req, body);
    await setPaused(paused);
    console.log(`[admin] distributions ${paused ? "paused" : "resumed"}`);
    return NextResponse.json({ paused });
  } catch (err) {
    return handleError(err, "admin/pause");
  }
}

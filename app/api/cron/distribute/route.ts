import { NextResponse } from "next/server";
import { bearerOrHeader, handleError, jsonError, secretMatches } from "@/lib/api";
import { env } from "@/lib/env";
import { runDistribution } from "@/lib/distribute";

export const dynamic = "force-dynamic";
// Needs Vercel Pro for anything over 60s. Batches stop at 240s and resume on the next run.
export const maxDuration = 300;

/**
 * Called by Vercel Cron every 10 minutes (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; `x-cron-secret` also works for manual runs.
 */
async function handle(req: Request) {
  if (!secretMatches(bearerOrHeader(req, "x-cron-secret"), env().CRON_SECRET)) return jsonError("Unauthorized", 401, "unauthorized");
  try {
    const result = await runDistribution();
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err, "cron/distribute");
  }
}

export const GET = handle;
export const POST = handle;

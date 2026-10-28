import { NextResponse } from "next/server";
import { z } from "zod";
import { RANGES, getStatSeries, type Range } from "@/lib/queries";

export const dynamic = "force-dynamic";

const query = z.object({ range: z.enum(Object.keys(RANGES) as [Range, ...Range[]]).default("24h") });

export async function GET(req: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "range must be one of 1m, 1h, 6h, 24h, 7d" }, { status: 400 });
  const points = await getStatSeries(parsed.data.range);
  return NextResponse.json({ points }, { headers: { "Cache-Control": "public, max-age=10, s-maxage=10" } });
}

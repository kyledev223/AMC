import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";

/** Collection-level metadata for the Metaplex Core collection. */
export function GET() {
  return NextResponse.json(
    {
      name: "Anime Milker Cult",
      symbol: "AMC",
      description: "Girls summoned by burning $AMC. Each one's milk earns a share of creator fees. A parody. All characters are fictional adults.",
      image: `${SITE_URL}/girls/priestess.webp`,
      external_url: SITE_URL,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

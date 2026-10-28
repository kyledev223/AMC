import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/config";
import { displayName, getSeries, getTier } from "@/lib/girls";
import { isPublicKey } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Metaplex JSON metadata for a girl. Sealed until the mint is confirmed and recorded. */
export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  if (!isPublicKey(assetId)) return NextResponse.json({ error: "Not a valid asset address" }, { status: 400 });

  const client = db();
  const mint = client ? await client.mint.findUnique({ where: { assetId } }) : null;
  const series = mint ? getSeries(mint.series) : undefined;
  const tier = mint ? getTier(mint.tier) : undefined;

  if (!mint || !series || !tier) {
    const pending = client ? await client.pendingMint.findUnique({ where: { assetId }, select: { assetId: true } }) : null;
    if (!pending) return NextResponse.json({ error: "Unknown girl" }, { status: 404 });
    return NextResponse.json(
      {
        name: "Sealed AMC girl",
        symbol: "AMC",
        description: "A girl from the Anime Milker Cult, still sealed. She is revealed once her summon confirms.",
        image: `${SITE_URL}/sealed.svg`,
        attributes: [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const image = `${SITE_URL}/girls/${series.image}.webp`;
  return NextResponse.json(
    {
      name: displayName(series, mint.serial),
      symbol: "AMC",
      description: `${series.name}, ${series.title}. ${tier.name} tier. “${series.quote}” Anime Milker Cult is a parody. All characters are fictional adults.`,
      image,
      external_url: `${SITE_URL}/girl/${assetId}`,
      attributes: [
        { trait_type: "series", value: series.id },
        { trait_type: "tier", value: tier.id },
        { trait_type: "milk_rate", value: mint.milkRate },
        { trait_type: "serial", value: mint.serial },
      ],
      properties: { category: "image", files: [{ uri: image, type: "image/webp" }] },
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}

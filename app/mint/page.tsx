import type { Metadata } from "next";
import Link from "next/link";
import { MintFlow } from "@/components/mint/MintFlow";
import { ODDS_TABLE, formatPercent } from "@/lib/girls";

export const metadata: Metadata = { title: "Summon a girl", description: "Burn $AMC to summon a random anime girl NFT." };

export default function MintPage() {
  const rarest = ODDS_TABLE.reduce((a, b) => (b.weight < a.weight ? b : a));
  return (
    <div className="wrap py-12 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="panel p-5 sm:p-8">
          <h1 className="page-title">Summon a girl</h1>
          <p className="intro mb-8">Burn $AMC and one of 18 girls answers. Her milk earns you a share of every fee from the next distribution on.</p>
          <MintFlow />
        </div>
        <aside className="prose-cult">
          <h2 className="room-title">What you can get</h2>
          <p className="mt-3">
            Six girls, each in Devoted, Gilded or Divine. The rarest is {rarest.series.name} in {rarest.tier.name} at {formatPercent(rarest.percent)}.
          </p>
          <ul>
            <li>Devoted: plain gold border, 1&times; milk.</li>
            <li>Gilded: gold foil, 2.5&times; milk.</li>
            <li>Divine: holographic, 6&times; milk.</li>
          </ul>
          <p className="mt-4"><Link href="/docs#odds">See all 18 odds</Link> &middot; <Link href="/docs#fairness">How the roll is checked</Link></p>
        </aside>
      </div>
    </div>
  );
}

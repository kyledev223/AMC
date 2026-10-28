import Link from "next/link";
import { HeroLineup } from "@/components/HeroLineup";
import { TickerTape } from "@/components/TickerTape";
import { NetworkStats } from "@/components/NetworkStats";
import { CollectionViewer } from "@/components/CollectionViewer";
import { StatChart } from "@/components/charts/StatChart";
import { PayoutsTable } from "@/components/PayoutsTable";
import { MintTrigger } from "@/components/MintTrigger";
import { getNetworkStats, getRecentPayouts } from "@/lib/queries";
import { amcDecimals } from "@/lib/solana";
import { env } from "@/lib/env";
import { formatInt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, payouts, decimals] = await Promise.all([getNetworkStats(), getRecentPayouts(20), amcDecimals()]);
  const cost = formatInt(env().MINT_COST_AMC);

  return (
    <>
      <section className="altar" aria-labelledby="hero-title">
        <span className="kana l" aria-hidden="true">アニメ・ミルカー教団</span>
        <span className="kana r" aria-hidden="true">売らない。信じる。</span>
        <div className="wrap relative z-10">
          <h1 className="hero-title" id="hero-title">Anime Milker Cult</h1>
          <p className="ticker-name">$AMC on Solana</p>
          <p className="lede">Burn $AMC to summon a girl. Her milk earns you a share of every fee.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <MintTrigger />
            <Link className="btn btn-ghost" href="/docs">How it works</Link>
          </div>
        </div>
        <HeroLineup />
      </section>

      <TickerTape />

      <section className="wrap pt-12" aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">Network stats</h2>
        <NetworkStats stats={stats} amcDecimals={decimals} />
      </section>

      <section className="room" aria-labelledby="collection-title">
        <div className="wrap">
          <h2 className="room-title" id="collection-title">The collection</h2>
          <p className="intro">Six girls, three tiers each. Rarer girls make more milk. Move your cursor or finger over a card to tilt it.</p>
          <CollectionViewer />
          <p className="mt-2 text-sm text-ash">
            Odds come from one config file and add up to exactly 100%. <Link href="/docs#odds">See the full odds table</Link>.
          </p>
        </div>
      </section>

      <section
        className="room"
        aria-labelledby="how-title"
        style={{ background: "linear-gradient(to bottom, var(--sanctum), var(--sanctum-2) 30%, var(--sanctum-2) 70%, var(--sanctum))" }}
      >
        <div className="wrap grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div>
            <h2 className="room-title" id="how-title">Burn &middot; mint &middot; earn</h2>
            <ol className="steps">
              <li>
                <div>
                  <h3>Burn {cost} $AMC</h3>
                  <p>Connect a wallet and press Summon. The $AMC is burned forever in the same transaction that mints your girl.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>A random girl answers</h3>
                  <p>One of 18 girls lands in your wallet as an NFT. The roll is committed before you sign and revealed after, so anyone can check it.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Her milk earns a share of fees</h3>
                  <p>Every 10 minutes the fee pool is split between holders by their share of total milk output. It goes straight to the wallet holding the girl.</p>
                </div>
              </li>
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <MintTrigger>Summon a girl</MintTrigger>
              <Link className="btn btn-ghost" href="/docs#fees">Read the fee flow</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[380px]" style={{ isolation: "isolate" }}>
            <div className="absolute left-1/2 top-[8%] -z-10 aspect-square w-[78%] -translate-x-1/2 rounded-full border-[1.5px] border-gold-dim" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--lacquer) 80%, transparent), transparent 70%)" }} />
            <img src="/girls/heiress.webp" alt="The Dairy Heiress holding a crate of AMC milk bottles" width={800} height={1200} loading="lazy" style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }} />
          </div>
        </div>
      </section>

      <section className="room pt-0" aria-labelledby="milk-title">
        <div className="wrap">
          <h2 className="room-title" id="milk-title">Milk output</h2>
          <p className="intro">Total milk across every girl in the collection. Each wallet&rsquo;s share of the pool is its milk divided by this number.</p>
          <div className="mt-8">
            <StatChart metric="totalMilk" amcDecimals={decimals} />
          </div>
        </div>
      </section>

      <section className="room pt-0" aria-labelledby="payouts-title">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="room-title" id="payouts-title">Recent payouts</h2>
            <Link href="/payouts" className="btn btn-ghost btn-sm">See every payout</Link>
          </div>
          <PayoutsTable
            rows={payouts}
            empty="The last 20 payouts will show here. A distribution runs every 10 minutes."
          />
        </div>
      </section>
    </>
  );
}

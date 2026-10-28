import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicKey as umiPk } from "@metaplex-foundation/umi";
import { safeFetchAssetV1 } from "@metaplex-foundation/mpl-core";
import { GirlCard } from "@/components/GirlCard";
import { Halo } from "@/components/Halo";
import { getGirlShares, getMint, getNetworkStats } from "@/lib/queries";
import { displayName, getRow, getSeries, getTier, girlImage, formatPercent } from "@/lib/girls";
import { sha256Hex, ticketFromRoll } from "@/lib/fairness";
import { formatDateTime, formatMilk, formatSol, formatUnits } from "@/lib/format";
import { shortAddress, solscan } from "@/lib/config";
import { isPublicKey } from "@/lib/validate";
import { amcDecimals } from "@/lib/solana";
import { getUmi } from "@/lib/umi";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ assetId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { assetId } = await params;
  const m = isPublicKey(assetId) ? await getMint(assetId) : null;
  const s = m ? getSeries(m.series) : undefined;
  if (!m || !s) return { title: "Girl not found" };
  return { title: displayName(s, m.serial), description: `${s.name}, ${s.title}. ${getTier(m.tier)?.name} tier.`, openGraph: { images: [girlImage(s)] } };
}

async function liveOwner(assetId: string): Promise<string | null> {
  try {
    return (await safeFetchAssetV1(getUmi(), umiPk(assetId)))?.owner.toString() ?? null;
  } catch {
    return null;
  }
}

export default async function GirlPage({ params }: Props) {
  const { assetId } = await params;
  if (!isPublicKey(assetId)) notFound();
  const mint = await getMint(assetId);
  if (!mint) notFound();
  const series = getSeries(mint.series);
  const tier = getTier(mint.tier);
  const row = getRow(mint.series, mint.tier);
  if (!series || !tier || !row) notFound();

  const [shares, stats, owner, decimals] = await Promise.all([getGirlShares(assetId), getNetworkStats(), liveOwner(assetId), amcDecimals()]);
  const holder = owner ?? mint.owner;
  const share = stats.totalMilk > 0 ? (mint.milkRate / stats.totalMilk) * 100 : 0;
  const commitOk = sha256Hex(mint.seedReveal) === mint.seedCommit;
  const ticket = ticketFromRoll(mint.roll);

  return (
    <div className="wrap py-12 sm:py-16">
      <div className="grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start">
        <div className="relative mx-auto w-full max-w-[420px]" style={{ isolation: "isolate" }}>
          <Halo className="left-1/2 top-[6%] w-[80%] -translate-x-1/2" style={{ zIndex: -1 }} />
          <img src={girlImage(series)} alt={series.alt} width={800} height={1200} style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }} />
          <div className="mx-auto mt-6 w-[220px]">
            <GirlCard series={series} tier={tier} milkRate={mint.milkRate} serial={mint.serial} />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-gold">{series.rank} &middot; {series.title} &middot; {tier.name}</p>
          <h1 className="mt-1.5 text-[2.4rem] font-black leading-tight">{displayName(series, mint.serial)}</h1>
          <p className="mt-4 border-l-2 border-lacquer pl-4 font-display text-[1.6rem] leading-snug">&ldquo;{series.quote}&rdquo;</p>
          <p className="mt-5 max-w-[34em] text-ash">{series.lore}</p>
          <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-sm">
            {series.facts.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-gold-dim">{k}</dt><dd className="text-milk">{v}</dd></div>
            ))}
          </dl>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-[1.5px] border-gold/25 bg-gold/15 sm:grid-cols-3">
            {[
              ["Milk", formatMilk(mint.milkRate)],
              ["Share of network", `${share.toFixed(3)}%`],
              ["Lifetime earnings", formatSol(mint.earned)],
              ["Odds", formatPercent(row.percent)],
              ["Serial", `#${String(mint.serial).padStart(4, "0")}`],
              ["Burned to mint", `${formatUnits(mint.burnAmount, decimals, 0)} $AMC`],
            ].map(([k, v]) => (
              <div key={k} className="bg-sanctum-2 px-4 py-4">
                <dt className="text-xs text-ash">{k}</dt>
                <dd className="mono mt-1 font-semibold text-milk">{v}</dd>
              </div>
            ))}
          </dl>

          <dl className="mt-8 grid gap-3 text-sm">
            <div className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-ash">Owner</dt>
              <dd><Link className="mono no-underline" href={`/payouts?wallet=${holder}`}>{shortAddress(holder, 6)}</Link></dd>
            </div>
            <div className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-ash">Mint transaction</dt>
              <dd><a className="mono no-underline" href={solscan("tx", mint.burnTx)} target="_blank" rel="noopener noreferrer">{shortAddress(mint.burnTx, 6)}</a></dd>
            </div>
            <div className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-ash">Asset</dt>
              <dd><a className="mono no-underline" href={solscan("token", mint.assetId)} target="_blank" rel="noopener noreferrer">{shortAddress(mint.assetId, 6)}</a></dd>
            </div>
            <div className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-ash">Summoned</dt>
              <dd className="mono text-milk">{formatDateTime(mint.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="mt-16" aria-labelledby="verify-title">
        <h2 id="verify-title" className="room-title">Check the roll</h2>
        <p className="intro">The seed was committed before the mint was signed. Hash it to check the commitment, then redo the roll.</p>
        <dl className="panel mt-6 grid gap-4 p-5 text-sm">
          {[
            ["Commitment, sha256(seed)", mint.seedCommit],
            ["Seed, revealed", mint.seedReveal],
            ["Wallet", mint.minter],
            ["Recent blockhash", mint.blockhash],
            ["Roll, sha256(seed + wallet + blockhash)", mint.roll],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-gold-dim">{k}</dt>
              <dd className="mono mt-1 break-all text-milk">{v}</dd>
            </div>
          ))}
          <div>
            <dt className="text-gold-dim">Result</dt>
            <dd className="mt-1 text-milk">
              First 8 bytes mod 10,000 = <span className="mono">{ticket}</span>, which lands on {series.name}, {tier.name}.{" "}
              {commitOk ? <span className="text-up">The seed matches its commitment.</span> : <span className="text-down">The seed does not match its commitment.</span>}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-16" aria-labelledby="history-title">
        <h2 id="history-title" className="room-title">Payout history</h2>
        {shares.length === 0 ? (
          <p className="note mt-6">Her share of each distribution will be listed here, starting with the first one after she was summoned.</p>
        ) : (
          <div className="panel mt-6 overflow-x-auto">
            <table className="ledger">
              <thead><tr><th scope="col">Epoch</th><th scope="col">Time</th><th scope="col">Holder</th><th scope="col" className="num">Her share</th></tr></thead>
              <tbody>
                {shares.map((s) => (
                  <tr key={s.epochId}>
                    <td className="mono">{s.epochId}</td>
                    <td className="whitespace-nowrap text-ash">{formatDateTime(s.at)}</td>
                    <td className="mono">{shortAddress(s.wallet)}</td>
                    <td className="num">{formatSol(s.amount)}{s.dryRun ? <span className="text-ash"> (dry run)</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

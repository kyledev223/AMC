import type { Metadata } from "next";
import { NetworkStats } from "@/components/NetworkStats";
import { StatChart } from "@/components/charts/StatChart";
import { SeriesOddsChart } from "@/components/charts/SeriesOddsChart";
import { EpochChart } from "@/components/charts/EpochChart";
import { getNetworkStats, getRecentEpochs, getSeriesCounts } from "@/lib/queries";
import { amcDecimals } from "@/lib/solana";
import { SERIES } from "@/lib/girls";
import { formatInt, formatMilk, formatSol, formatDateTime, toUnits } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats", description: "Network stats: milk output, mints per series, $AMC burned, pool size and payouts." };

export default async function StatsPage() {
  const [stats, counts, epochs, decimals] = await Promise.all([getNetworkStats(), getSeriesCounts(), getRecentEpochs(48), amcDecimals()]);

  const total = counts.reduce((s, c) => s + c.count, 0);
  const seriesData = SERIES.map((s) => {
    const minted = counts.filter((c) => c.series === s.id).reduce((n, c) => n + c.count, 0);
    return { name: s.title.replace("The ", ""), minted, actual: total ? (minted / total) * 100 : 0, expected: s.weight };
  });
  const epochData = [...epochs].reverse().map((e) => ({ id: e.id, paid: toUnits(e.paid, 9), dryRun: e.dryRun }));

  return (
    <div className="wrap py-12 sm:py-16">
      <h1 className="page-title">Stats</h1>
      <p className="intro">The whole network in numbers. Charts update after every mint and every distribution.</p>

      <div className="mt-10">
        <NetworkStats stats={stats} amcDecimals={decimals} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <StatChart metric="totalMilk" amcDecimals={decimals} height={320} />
        </div>
        <SeriesOddsChart data={seriesData} total={total} />
        <EpochChart data={epochData} />
        <StatChart metric="burned" amcDecimals={decimals} />
        <StatChart metric="pool" amcDecimals={decimals} title="Pool size at each distribution" />
      </div>

      <section className="mt-14" aria-labelledby="series-table">
        <h2 id="series-table" className="room-title">Mints by series</h2>
        <div className="panel mt-6 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr><th scope="col">Series</th><th scope="col" className="num">Minted</th><th scope="col" className="num">Share</th><th scope="col" className="num">Odds</th></tr>
            </thead>
            <tbody>
              {seriesData.map((s) => (
                <tr key={s.name}><td className="text-milk">{s.name}</td><td className="num">{formatInt(s.minted)}</td><td className="num">{s.actual.toFixed(2)}%</td><td className="num">{s.expected}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="epochs-table">
        <h2 id="epochs-table" className="room-title">Recent epochs</h2>
        {epochs.length === 0 ? (
          <p className="note mt-6">Each 10-minute distribution will be listed here with its pool, total milk and amount paid.</p>
        ) : (
          <div className="panel mt-6 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr><th scope="col">Epoch</th><th scope="col">Time</th><th scope="col">Status</th><th scope="col" className="num">Pool</th><th scope="col" className="num">Milk</th><th scope="col" className="num">Holders</th><th scope="col" className="num">Paid</th></tr>
              </thead>
              <tbody>
                {epochs.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{e.id}</td>
                    <td className="whitespace-nowrap text-ash">{formatDateTime(e.startedAt)}</td>
                    <td className={e.status === "complete" ? "text-up" : e.status === "failed" ? "text-down" : "text-ash"}>{e.dryRun ? `${e.status}, dry run` : e.status}</td>
                    <td className="num">{formatSol(e.poolAmount)}</td>
                    <td className="num">{formatMilk(Number(e.totalMilk))}</td>
                    <td className="num">{e.holders}</td>
                    <td className="num">{formatSol(e.paid)}</td>
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

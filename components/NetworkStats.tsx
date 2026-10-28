import type { NetworkStats as Stats } from "@/lib/queries";
import { formatInt, formatMilk, formatUnits, formatSol } from "@/lib/format";
import { Countdown } from "./Countdown";

export function NetworkStats({ stats, amcDecimals }: { stats: Stats; amcDecimals: number }) {
  const items: [string, string, string?][] = [
    ["Total milk output", formatMilk(stats.totalMilk)],
    ["Girls minted", formatInt(stats.girls)],
    ["$AMC burned", formatUnits(stats.burned, amcDecimals, 0)],
    ["Total paid out", formatSol(stats.paidOut)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-[1.5px] border-gold/25 bg-gold/15 md:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="bg-sanctum-2 px-4 py-5">
          <dt className="text-sm text-ash">{label}</dt>
          <dd className="mono mt-1.5 text-lg font-semibold text-milk sm:text-xl">{value}</dd>
        </div>
      ))}
      <div className="col-span-2 bg-sanctum-2 px-4 py-5 md:col-span-1">
        <dt className="text-sm text-ash">Next distribution</dt>
        <dd className="mt-1.5">
          <Countdown target={stats.nextEpochAt} enabled={stats.distributionsEnabled && !stats.paused} paused={stats.paused} />
        </dd>
      </div>
    </dl>
  );
}

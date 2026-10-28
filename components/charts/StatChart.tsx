"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Range, StatSeriesPoint } from "@/lib/queries";
import { formatCompact, formatMilk, toUnits } from "@/lib/format";

const RANGE_KEYS: Range[] = ["1m", "1h", "6h", "24h", "7d"];

export type Metric = "totalMilk" | "girls" | "burned" | "pool" | "paidOut";

const METRIC: Record<Metric, { label: string; value: (p: StatSeriesPoint, d: number) => number; format: (n: number) => string }> = {
  totalMilk: { label: "Total milk output", value: (p) => p.totalMilk, format: (n) => formatMilk(n) },
  girls: { label: "Girls minted", value: (p) => p.girls, format: (n) => n.toLocaleString("en-US") },
  burned: { label: "$AMC burned", value: (p, d) => toUnits(p.burned, d), format: (n) => `${formatCompact(n)} $AMC` },
  pool: { label: "Pool size", value: (p) => toUnits(p.pool, 9), format: (n) => `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL` },
  paidOut: { label: "Total paid out", value: (p) => toUnits(p.paidOut, 9), format: (n) => `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL` },
};

function tickTime(t: number, range: Range): string {
  const d = new Date(t);
  if (range === "7d") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: range === "1m" ? "2-digit" : undefined, hour12: false });
}

/** One metric over time, with range tabs. Single series, so the title names it and there's no legend box. */
export function StatChart({
  metric = "totalMilk",
  amcDecimals = 6,
  initialRange = "24h",
  height = 280,
  title,
}: {
  metric?: Metric;
  amcDecimals?: number;
  initialRange?: Range;
  height?: number;
  title?: string;
}) {
  const [range, setRange] = useState<Range>(initialRange);
  const [loaded, setLoaded] = useState<{ points: StatSeriesPoint[]; at: number } | null>(null);
  const [error, setError] = useState(false);
  const m = METRIC[metric];

  useEffect(() => {
    let live = true;
    fetch(`/api/stats/series?range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { points: StatSeriesPoint[] }) => {
        if (!live) return;
        setLoaded({ points: d.points, at: Date.now() });
        setError(false);
      })
      .catch(() => live && setError(true));
    return () => { live = false; };
  }, [range]);

  const points = loaded?.points ?? null;
  const now = loaded?.at ?? 0;
  const data = (points ?? []).map((p) => ({ t: p.t, v: m.value(p, amcDecimals) }));
  // Extend the last value to now so the line reaches the right edge.
  const last = data.at(-1);
  if (last && last.t < now) data.push({ t: now, v: last.v });
  const latest = last?.v ?? 0;

  return (
    <figure className="panel m-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption>
          <p className="text-sm text-ash">{title ?? m.label}</p>
          <p className="mono mt-1 text-xl font-semibold text-milk">{m.format(latest)}</p>
        </figcaption>
        <div className="tabs" role="tablist" aria-label="Time range">
          {RANGE_KEYS.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4" style={{ height }}>
        {error ? (
          <p className="grid h-full place-items-center text-center text-sm text-ash">The chart could not load. Refresh to try again.</p>
        ) : points === null ? (
          <p className="grid h-full place-items-center text-sm text-ash">Loading the chart</p>
        ) : data.length < 2 ? (
          <p className="grid h-full place-items-center px-6 text-center text-sm text-ash">
            Nothing in this range yet. The line starts with the first mint and updates after every mint and every distribution.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d6b260" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#d6b260" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f4ede3" strokeOpacity={0.07} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
                tickFormatter={(t: number) => tickTime(t, range)}
                tick={{ fill: "#b29d97", fontSize: 11, fontFamily: "var(--f-tape)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fill: "#b29d97", fontSize: 11, fontFamily: "var(--f-tape)" }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "#d6b260", strokeOpacity: 0.5 }}
                contentStyle={{ background: "#16090b", border: "1px solid #8f7440", borderRadius: 10, fontFamily: "var(--f-tape)", fontSize: 12 }}
                labelStyle={{ color: "#b29d97" }}
                itemStyle={{ color: "#f4ede3" }}
                labelFormatter={(t) => new Date(Number(t)).toLocaleString("en-US", { hour12: false })}
                formatter={(v) => [m.format(Number(v)), m.label]}
              />
              <Area type="stepAfter" dataKey="v" stroke="#d6b260" strokeWidth={2} fill={`url(#fill-${metric})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, stroke: "#16090b", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}

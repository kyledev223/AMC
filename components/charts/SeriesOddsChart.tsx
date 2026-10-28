"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SeriesOddsDatum = { name: string; minted: number; actual: number; expected: number };

const ACTUAL = "#d6b260";
const EXPECTED = "#7a8fd6";

/** Share of mints per series against the published odds. Two series, so a legend is always shown. */
export function SeriesOddsChart({ data, total }: { data: SeriesOddsDatum[]; total: number }) {
  return (
    <figure className="panel m-0 p-4 sm:p-5">
      <figcaption>
        <p className="text-sm text-ash">Girls minted per series against the odds</p>
        <p className="mono mt-1 text-xl font-semibold text-milk">{total.toLocaleString("en-US")} minted</p>
      </figcaption>
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid stroke="#f4ede3" strokeOpacity={0.07} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#b29d97", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: "#b29d97", fontSize: 11, fontFamily: "var(--f-tape)" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ fill: "#6a1520", fillOpacity: 0.25 }}
              contentStyle={{ background: "#16090b", border: "1px solid #8f7440", borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: "#f4ede3", fontWeight: 700 }}
              itemStyle={{ color: "#f4ede3", fontFamily: "var(--f-tape)" }}
              formatter={(v, name) => [`${Number(v).toFixed(2)}%`, name === "actual" ? "Minted" : "Odds"]}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="square"
              formatter={(v) => <span style={{ color: "#b29d97", fontSize: 12 }}>{v === "actual" ? "Minted" : "Odds"}</span>}
            />
            <Bar dataKey="actual" fill={ACTUAL} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expected" fill={EXPECTED} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

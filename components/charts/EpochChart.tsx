"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type EpochDatum = { id: number; paid: number; dryRun: boolean };

/** Amount paid per epoch. Single series: the title names it. */
export function EpochChart({ data }: { data: EpochDatum[] }) {
  return (
    <figure className="panel m-0 p-4 sm:p-5">
      <figcaption>
        <p className="text-sm text-ash">Payouts per epoch (SOL)</p>
        <p className="mono mt-1 text-xl font-semibold text-milk">{data.length} epochs</p>
      </figcaption>
      <div className="mt-4 h-[260px]">
        {data.length === 0 ? (
          <p className="grid h-full place-items-center px-6 text-center text-sm text-ash">
            Each bar is one 10-minute distribution. Bars appear after the first one runs.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke="#f4ede3" strokeOpacity={0.07} vertical={false} />
              <XAxis dataKey="id" tick={{ fill: "#b29d97", fontSize: 11, fontFamily: "var(--f-tape)" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={{ fill: "#b29d97", fontSize: 11, fontFamily: "var(--f-tape)" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                cursor={{ fill: "#6a1520", fillOpacity: 0.25 }}
                contentStyle={{ background: "#16090b", border: "1px solid #8f7440", borderRadius: 10, fontSize: 12, fontFamily: "var(--f-tape)" }}
                labelStyle={{ color: "#b29d97" }}
                itemStyle={{ color: "#f4ede3" }}
                labelFormatter={(id) => `Epoch ${id}`}
                formatter={(v, _n, item) => [`${Number(v).toLocaleString("en-US", { maximumFractionDigits: 6 })} SOL${(item.payload as EpochDatum).dryRun ? " (dry run)" : ""}`, "Paid"]}
              />
              <Bar dataKey="paid" fill="#d6b260" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}

"use client";

import { useRef, useState } from "react";
import { ODDS_TABLE, TIERS, type TierId } from "@/lib/girls";
import { GirlCard } from "./GirlCard";

/** All 18 cards in a snap-scrolling rail, filterable by tier. */
export function CollectionViewer() {
  const rail = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<TierId | "all">("all");
  const rows = ODDS_TABLE.filter((r) => tier === "all" || r.tier.id === tier);

  function scroll(dir: 1 | -1) {
    const el = rail.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="tabs" role="tablist" aria-label="Filter by tier">
          {(["all", ...TIERS.map((t) => t.id)] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tier === t} onClick={() => setTier(t)}>
              {t === "all" ? "All 18" : TIERS.find((x) => x.id === t)?.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => scroll(-1)} aria-label="Scroll the collection back">
            Back
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => scroll(1)} aria-label="Scroll the collection forward">
            Next
          </button>
        </div>
      </div>
      <div ref={rail} className="rail" role="region" aria-label="The collection" tabIndex={0}>
        {rows.map((r) => (
          <GirlCard key={r.key} series={r.series} tier={r.tier} milkRate={r.milkRate} odds={r.percent} />
        ))}
      </div>
    </div>
  );
}

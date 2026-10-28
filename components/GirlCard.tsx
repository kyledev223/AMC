"use client";

import { useRef } from "react";
import type { Series, Tier } from "@/lib/girls";
import { girlImage, formatPercent } from "@/lib/girls";
import { formatMilk } from "@/lib/format";
import { Halo } from "./Halo";

type Props = {
  series: Series;
  tier: Tier;
  milkRate: number;
  /** Odds in percent. Shown on collection cards. */
  odds?: number;
  serial?: number;
  /** Tilt toward the pointer. Off for static uses such as the reveal back face. */
  tilt?: boolean;
  priority?: boolean;
  className?: string;
};

/**
 * One girl in one tier. Devoted: plain gold border. Gilded: animated foil sheen.
 * Divine: holographic border, holo foil, halo and glow. Tilt follows the cursor or finger.
 */
export function GirlCard({ series, tier, milkRate, odds, serial, tilt = true, priority = false, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!tilt || !el || reduced()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.dataset.active = "true";
    el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.dataset.active = "false";
    for (const p of ["--rx", "--ry"]) el.style.setProperty(p, "0deg");
    for (const p of ["--mx", "--my"]) el.style.setProperty(p, "50%");
  }

  const label = `${series.name}, ${tier.name}${serial ? `, number ${serial}` : ""}. ${formatMilk(milkRate)}${odds !== undefined ? `. ${formatPercent(odds)} chance` : ""}`;

  return (
    <div className={`card-scene ${className}`}>
      <div
        ref={ref}
        className="girl-card"
        data-tier={tier.id}
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerCancel={onLeave}
      >
        {tier.id === "divine" && <Halo className="card-halo" />}
        <div className="art">
          <img
            src={girlImage(series, "md")}
            alt=""
            width={480}
            height={720}
            loading={priority ? "eager" : "lazy"}
            draggable={false}
          />
        </div>
        {tier.id !== "devoted" && <div className="foil" />}
        <div className="shine" />
        <div className="plate">
          <p className="text-xs font-bold text-gold">
            {tier.name}
            {serial ? <span className="mono font-normal text-ash"> #{String(serial).padStart(4, "0")}</span> : null}
          </p>
          <p className="mt-0.5 text-[0.95rem] font-black leading-tight text-milk">{series.short}</p>
          <p className="text-xs text-ash">{series.title}</p>
          <div className="mono mt-2 flex items-center justify-between gap-2 text-[0.72rem]">
            <span className="text-milk">{formatMilk(milkRate)}</span>
            {odds !== undefined && <span className="text-gold">{formatPercent(odds)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { Series, Tier } from "@/lib/girls";
import { GirlCard } from "@/components/GirlCard";
import { Halo } from "@/components/Halo";
import { Sigil } from "@/components/Sigil";

export type RevealPhase = "spin" | "flare" | "done";

/**
 * The one big motion moment: the card spins face down under the Halo while the transaction
 * confirms, rays flare (stronger for Gilded, a holo burst for Divine), then it flips to her face.
 * Under reduced motion it goes straight to the result.
 */
export function Reveal({
  result,
  serial,
  milkRate,
}: {
  result: { series: Series; tier: Tier } | null;
  serial?: number;
  milkRate?: number;
}) {
  const [flared, setFlared] = useState(false);

  useEffect(() => {
    if (!result) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduced ? 0 : result.tier.id === "divine" ? 1300 : result.tier.id === "gilded" ? 1000 : 750;
    const t = setTimeout(() => setFlared(true), wait);
    return () => clearTimeout(t);
  }, [result]);

  const phase: RevealPhase = !result ? "spin" : flared ? "done" : "flare";
  const flipped = phase === "done";

  return (
    <div className="reveal-stage" data-phase={phase} data-tier={result?.tier.id ?? "devoted"}>
      <Halo />
      <div className="reveal-rays" aria-hidden="true" />
      <div className="reveal-card">
        <div className="reveal-flip" data-flipped={flipped}>
          <div className="reveal-face">
            <div className="card-back" aria-hidden={flipped}>
              <Sigil />
            </div>
          </div>
          <div className="reveal-face reveal-back" aria-hidden={!flipped}>
            {result && <GirlCard series={result.series} tier={result.tier} milkRate={milkRate ?? 0} serial={serial} priority />}
          </div>
        </div>
      </div>
    </div>
  );
}

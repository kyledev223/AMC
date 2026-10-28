"use client";

import { useEffect, useState } from "react";
import { EPOCH_SECONDS } from "@/lib/config";

/** Counts down to the next 10-minute boundary, rolling over by itself. */
export function Countdown({ target, enabled, paused = false }: { target: number; enabled: boolean; paused?: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [enabled]);

  if (paused) return <span className="text-base font-bold text-down">Distributions paused</span>;
  if (!enabled) return <span className="text-base font-bold text-gold">Not running yet</span>;

  let text = "--:--";
  if (now !== null) {
    const period = EPOCH_SECONDS * 1000;
    let t = target;
    while (t <= now) t += period;
    const left = Math.ceil((t - now) / 1000);
    text = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  }

  return (
    <span className="mono text-lg font-semibold text-gold sm:text-xl">
      <span className="sr-only">Next distribution in </span>
      {text}
    </span>
  );
}

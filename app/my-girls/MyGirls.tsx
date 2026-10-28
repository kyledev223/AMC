"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnectModal } from "@/components/providers/Providers";
import { GirlCard } from "@/components/GirlCard";
import { MintTrigger } from "@/components/MintTrigger";
import { getSeries, getTier } from "@/lib/girls";
import { formatMilk, formatSol } from "@/lib/format";
import type { MintRow } from "@/lib/queries";

type Data = { girls: MintRow[]; totalMilk: number; source: "chain" | "snapshot" };

export function MyGirls() {
  const { publicKey } = useWallet();
  const { open: openConnect } = useConnectModal();
  const wallet = publicKey?.toBase58();

  if (!wallet) {
    return (
      <div className="note mt-10 grid justify-items-start gap-4">
        <p>Connect a wallet to see its girls.</p>
        <button type="button" className="btn" onClick={() => openConnect()}>Connect a wallet</button>
      </div>
    );
  }
  // Keyed so switching wallets starts from a clean loading state.
  return <WalletGirls key={wallet} wallet={wallet} />;
}

function WalletGirls({ wallet }: { wallet: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/girls?owner=${wallet}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Couldn't load your girls.");
        return body as Data;
      })
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [wallet]);

  if (error) return <p className="mt-10 rounded-lg border border-down/50 bg-down/10 px-4 py-3 text-milk" role="alert">{error} Refresh to try again.</p>;
  if (!data) return <p className="mt-10 text-ash">Looking for your girls&hellip;</p>;

  if (data.girls.length === 0) {
    return (
      <div className="note mt-10 grid justify-items-start gap-4">
        <p>No girls in this wallet yet. Summon one and she&rsquo;ll appear here with her milk rate and earnings.</p>
        <MintTrigger>Summon a girl</MintTrigger>
      </div>
    );
  }

  const myMilk = data.girls.reduce((s, g) => s + g.milkRate, 0);
  const earned = data.girls.reduce((s, g) => s + BigInt(g.earned), 0n);
  const share = (milk: number) => (data.totalMilk > 0 ? (milk / data.totalMilk) * 100 : 0);

  return (
    <>
      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-[1.5px] border-gold/25 bg-gold/15 md:grid-cols-4">
        {[
          ["Girls", String(data.girls.length)],
          ["Your milk", formatMilk(myMilk)],
          ["Share of network", `${share(myMilk).toFixed(3)}%`],
          ["Lifetime earnings", formatSol(earned)],
        ].map(([k, v]) => (
          <div key={k} className="bg-sanctum-2 px-4 py-5">
            <dt className="text-sm text-ash">{k}</dt>
            <dd className="mono mt-1.5 text-lg font-semibold text-milk">{v}</dd>
          </div>
        ))}
      </dl>
      {data.source === "snapshot" && <p className="mt-3 text-sm text-ash">Showing ownership from the last snapshot. Live chain data was unavailable.</p>}

      <ul className="mt-10 grid grid-cols-1 gap-6 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {data.girls.map((g) => {
          const s = getSeries(g.series);
          const t = getTier(g.tier);
          if (!s || !t) return null;
          return (
            <li key={g.assetId}>
              <Link href={`/girl/${g.assetId}`} className="block no-underline" aria-label={`Open ${s.name} number ${g.serial}`}>
                <GirlCard series={s} tier={t} milkRate={g.milkRate} serial={g.serial} />
              </Link>
              <dl className="mono mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                <dt className="text-ash">Share</dt><dd className="text-milk">{share(g.milkRate).toFixed(3)}%</dd>
                <dt className="text-ash">Earned</dt><dd className="text-milk">{formatSol(g.earned)}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}

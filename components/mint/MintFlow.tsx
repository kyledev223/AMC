"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { getSeries, getTier, displayName, formatPercent, type Series, type Tier } from "@/lib/girls";
import { formatInt, formatMilk, formatUnits } from "@/lib/format";
import { AMC_MINT, COLLECTION_ADDRESS, SITE_URL, shortAddress } from "@/lib/config";
import { useConnectModal, useSiteConfig } from "@/components/providers/Providers";
import { Reveal } from "./Reveal";

type Step = "idle" | "preparing" | "signing" | "confirming" | "revealed" | "error";

type MintResult = {
  assetId: string;
  series: string;
  tier: string;
  serial: number;
  milkRate: number;
  odds: number | null;
  burnTx: string;
  seedCommit: string;
  seedReveal: string;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export function MintFlow({ onNavigate }: { onNavigate?: () => void }) {
  const { publicKey, connected } = useWallet();
  const { open: openConnect } = useConnectModal();
  const { mintCostAmc } = useSiteConfig();
  const wallet = publicKey?.toBase58() ?? null;

  if (!connected || !wallet) {
    return (
      <div className="grid gap-4">
        <p className="text-ash">Connect a wallet holding {formatInt(mintCostAmc)} $AMC to summon a girl.</p>
        <div>
          <button type="button" className="btn btn-lg" onClick={() => openConnect()}>Connect wallet</button>
        </div>
      </div>
    );
  }

  if (!AMC_MINT || !COLLECTION_ADDRESS) {
    return (
      <div className="note">
        Your wallet is connected. Summoning isn&rsquo;t open yet. Each girl costs {formatInt(mintCostAmc)} $AMC.
      </div>
    );
  }

  // Keyed by wallet so switching wallets starts a clean flow.
  return <WalletMintFlow key={wallet} wallet={wallet} onNavigate={onNavigate} />;
}

function WalletMintFlow({ wallet, onNavigate }: { wallet: string; onNavigate?: () => void }) {
  const { signTransaction } = useWallet();
  const { mintCostAmc } = useSiteConfig();

  const [balance, setBalance] = useState<{ amount: string; decimals: number } | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [commit, setCommit] = useState<{ commitId: string; commit: string } | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  /** Fetches the balance and a fresh seed commitment. Callers apply the result. */
  const fetchState = useCallback(
    () =>
      Promise.all([
        api<{ amount: string; decimals: number }>(`/api/balance?wallet=${wallet}`),
        api<{ commitId: string; commit: string }>("/api/mint/commit", { method: "POST", body: JSON.stringify({ wallet }) }),
      ]),
    [wallet],
  );

  const apply = useCallback((p: ReturnType<typeof fetchState>, isLive: () => boolean = () => true) => {
    return p
      .then(([b, c]) => {
        if (!isLive()) return;
        setBalance(b);
        setCommit(c);
        setBalanceError(null);
      })
      .catch((e: unknown) => isLive() && setBalanceError(e instanceof Error ? e.message : "Couldn't reach the server."));
  }, []);

  const refresh = useCallback(() => {
    setCommit(null);
    return apply(fetchState());
  }, [apply, fetchState]);

  useEffect(() => {
    let live = true;
    void apply(fetchState(), () => live);
    return () => { live = false; };
  }, [apply, fetchState]);

  const costBase = balance ? BigInt(mintCostAmc) * 10n ** BigInt(balance.decimals) : null;
  const enough = balance && costBase !== null ? BigInt(balance.amount) >= costBase : false;

  async function summon() {
    if (!commit) return;
    if (!signTransaction) {
      setError("This wallet can't sign transactions here. Try Phantom, Solflare or Backpack.");
      setStep("error");
      return;
    }
    setError(null);
    setResult(null);
    try {
      setStep("preparing");
      const prep = await api<{ assetId: string; transaction: string }>("/api/mint/prepare", {
        method: "POST",
        body: JSON.stringify({ wallet, commitId: commit.commitId }),
      });
      setStep("signing");
      const tx = Transaction.from(Buffer.from(prep.transaction, "base64"));
      let signed: Transaction;
      try {
        signed = await signTransaction(tx);
      } catch {
        throw new Error("You declined the transaction in your wallet. Nothing was burned.");
      }
      setStep("confirming");
      const serialized = signed.serialize({ requireAllSignatures: true }).toString("base64");
      // A confirm that times out on our side can be retried safely with the same transaction.
      let res: MintResult | null = null;
      for (let attempt = 0; attempt < 3 && !res; attempt++) {
        try {
          res = await api<MintResult>("/api/mint/confirm", { method: "POST", body: JSON.stringify({ assetId: prep.assetId, transaction: serialized }) });
        } catch (e) {
          if (attempt === 2 || !(e instanceof Error) || !/not confirmed yet|Something went wrong/i.test(e.message)) throw e;
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
      setResult(res);
      setStep("revealed");
      void api<{ amount: string; decimals: number }>(`/api/balance?wallet=${wallet}`).then(setBalance).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setStep("error");
      void refresh();
    }
  }

  function again() {
    setStep("idle");
    setResult(null);
    setError(null);
    void refresh();
  }

  const series: Series | undefined = result ? getSeries(result.series) : undefined;
  const tier: Tier | undefined = result ? getTier(result.tier) : undefined;
  const busy = step === "preparing" || step === "signing" || step === "confirming";
  const showStage = step === "confirming" || step === "revealed";

  if (showStage) {
    const shareText = series && tier && result ? `I summoned ${displayName(series, result.serial)}, ${tier.name}, from the Anime Milker Cult. $AMC` : "";
    return (
      <div className="grid gap-4 text-center">
        <Reveal result={series && tier ? { series, tier } : null} serial={result?.serial} milkRate={result?.milkRate} />
        <div aria-live="polite">
          {step === "confirming" && <p className="text-ash">Burning $AMC and waiting for the network to confirm&hellip;</p>}
          {step === "revealed" && series && tier && result && (
            <div className="grid gap-1">
              <p className="text-sm font-bold text-gold">{tier.name}{result.odds !== null ? ` · ${formatPercent(result.odds)} chance` : ""}</p>
              <h3 className="text-2xl font-black text-milk">{displayName(series, result.serial)}</h3>
              <p className="text-ash">{series.title} &middot; <span className="mono text-milk">{formatMilk(result.milkRate)}</span></p>
            </div>
          )}
        </div>
        {step === "revealed" && result && (
          <>
            <div className="flex flex-wrap justify-center gap-3">
              <Link className="btn" href="/my-girls" onClick={onNavigate}>View my girls</Link>
              <button type="button" className="btn btn-ghost" onClick={again}>Summon again</button>
              <a
                className="btn btn-ghost"
                href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${SITE_URL}/girl/${result.assetId}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Share on X
              </a>
            </div>
            <p className="text-xs text-ash">
              Seed revealed. <Link href={`/girl/${result.assetId}`} onClick={onNavigate}>Check the roll on her page</Link>.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gold/25 bg-gold/15">
        <div className="bg-sanctum px-4 py-3">
          <dt className="text-xs text-ash">Cost</dt>
          <dd className="mono mt-1 font-semibold text-milk">{formatInt(mintCostAmc)} $AMC</dd>
        </div>
        <div className="bg-sanctum px-4 py-3">
          <dt className="text-xs text-ash">Your balance</dt>
          <dd className={`mono mt-1 font-semibold ${balance && !enough ? "text-down" : "text-milk"}`}>
            {balance ? `${formatUnits(balance.amount, balance.decimals, 2)} $AMC` : balanceError ? "Unavailable" : "Checking…"}
          </dd>
        </div>
      </dl>

      <p className="font-bold text-milk">These $AMC are burned forever.</p>
      <p className="-mt-3 text-sm text-ash">You also pay about 0.003 SOL in network fees and storage for the NFT.</p>

      {balance && !enough && (
        <p className="text-sm text-down" role="alert">This wallet holds less than {formatInt(mintCostAmc)} $AMC. Buy more or switch wallets.</p>
      )}
      {balanceError && <p className="text-sm text-down" role="alert">{balanceError}</p>}
      {step === "error" && error && (
        <p className="rounded-lg border border-down/50 bg-down/10 px-4 py-3 text-sm text-milk" role="alert">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-lg" onClick={summon} disabled={busy || !commit || !enough}>
          {step === "preparing" ? "Preparing…" : step === "signing" ? "Approve in your wallet…" : "Summon"}
        </button>
        <span className="mono text-xs text-ash">{shortAddress(wallet)}</span>
      </div>

      <details className="text-sm text-ash">
        <summary className="cursor-pointer">Seed commitment</summary>
        <p className="mt-2">
          The server has committed to a secret seed before you sign. After the mint, the seed is revealed so you can check the roll.
        </p>
        <code className="mono mt-2 block break-all text-xs text-milk">{commit ? `sha256(seed) = ${commit.commit}` : "Waiting for a commitment…"}</code>
        <Link href="/docs#fairness" className="mt-2 inline-block" onClick={onNavigate}>How the roll works</Link>
      </details>
    </div>
  );
}

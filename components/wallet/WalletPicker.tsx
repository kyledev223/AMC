"use client";

import { useEffect, useRef } from "react";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { Sigil } from "@/components/Sigil";

type Known = { key: string; name: string; match: RegExp; install: string; mobileLink?: (href: string) => string };

/** Always listed, installed or not. Anything else the browser exposes through Wallet Standard is listed below them. */
const KNOWN: Known[] = [
  { key: "phantom", name: "Phantom", match: /^phantom$/i, install: "https://phantom.com/download", mobileLink: (h) => `https://phantom.app/ul/browse/${encodeURIComponent(h)}?ref=${encodeURIComponent(new URL(h).origin)}` },
  { key: "solflare", name: "Solflare", match: /^solflare$/i, install: "https://solflare.com/download", mobileLink: (h) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(h)}?ref=${encodeURIComponent(new URL(h).origin)}` },
  { key: "backpack", name: "Backpack", match: /^backpack$/i, install: "https://backpack.app/download" },
  {
    key: "okx",
    name: "OKX Wallet",
    match: /^okx/i,
    install: "https://www.okx.com/web3",
    mobileLink: (h) => `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(h)}`)}`,
  },
];

const isMobile = () => typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
const available = (w?: Wallet) => w?.readyState === WalletReadyState.Installed || w?.readyState === WalletReadyState.Loadable;

export function WalletPicker({ onClose }: { onClose: () => void }) {
  const { wallets, select, connecting, connected } = useWallet();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [onClose]);

  const used = new Set<Wallet>();
  const known = KNOWN.map((k) => {
    const w = wallets.find((x) => k.match.test(x.adapter.name) && !used.has(x));
    if (w) used.add(w);
    return { k, w };
  });
  // Other wallets this browser has installed (Jupiter, Magic Eden and so on).
  const others = wallets.filter((w) => !used.has(w) && w.readyState === WalletReadyState.Installed);

  function choose(name: WalletName) {
    // With autoConnect on, the provider connects as soon as a wallet is selected.
    select(name);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="wallet-picker-title" className="modal-panel panel w-[min(420px,100%)] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sigil />
            <h2 id="wallet-picker-title" className="text-xl font-black">Connect a wallet</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <p className="mt-3 text-sm text-ash">Pick the Solana wallet that holds your $AMC. Connecting only shares your address. Nothing is signed or spent.</p>

        <ul className="mt-5 grid gap-2">
          {known.map(({ k, w }) => (
            <li key={k.key}>
              {available(w) ? (
                <WalletRow name={k.name} icon={w!.adapter.icon} status={w!.readyState === WalletReadyState.Installed ? "Detected" : isMobile() ? "Open app" : "Web wallet"} onClick={() => choose(w!.adapter.name)} disabled={connecting} />
              ) : (
                <WalletRow
                  name={k.name}
                  icon={w?.adapter.icon}
                  status={isMobile() && k.mobileLink ? "Open app" : "Install"}
                  href={isMobile() && k.mobileLink ? k.mobileLink(window.location.href) : k.install}
                />
              )}
            </li>
          ))}
          {others.map((w) => (
            <li key={w.adapter.name}>
              <WalletRow name={w.adapter.name} icon={w.adapter.icon} status="Detected" onClick={() => choose(w.adapter.name)} disabled={connecting} />
            </li>
          ))}
        </ul>

        {connecting && <p className="mt-4 text-sm text-gold" role="status">Approve the connection in your wallet&hellip;</p>}
        <p className="mt-5 text-xs text-ash">Installed a wallet just now? Refresh this page so it shows up as detected.</p>
      </div>
    </div>
  );
}

function WalletRow({ name, icon, status, onClick, href, disabled }: { name: string; icon?: string; status: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const inner = (
    <>
      {icon ? (
        <img src={icon} alt="" width={32} height={32} className="size-8 rounded-lg" />
      ) : (
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg border border-gold-dim font-black text-gold">{name[0]}</span>
      )}
      <span className="flex-1 text-left font-bold text-milk">{name}</span>
      <span className={`text-xs ${status === "Detected" ? "text-up" : "text-ash"}`}>{status}</span>
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-xl border border-gold/20 bg-sanctum px-3.5 py-3 no-underline transition-colors hover:border-gold hover:bg-lacquer/30 disabled:opacity-60";
  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${status} ${name}`}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

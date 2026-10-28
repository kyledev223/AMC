"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { shortAddress } from "@/lib/config";
import { useConnectModal, useToast } from "@/components/providers/Providers";

export function ConnectButton({ className = "" }: { className?: string }) {
  const { publicKey, connecting, disconnect, wallet } = useWallet();
  const { open: openConnect } = useConnectModal();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [menu]);

  if (!publicKey) {
    return (
      <button type="button" className={`btn btn-ghost btn-sm ${className}`} onClick={() => openConnect()} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const address = publicKey.toBase58();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`btn btn-ghost btn-sm mono ${className}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
      >
        {wallet?.adapter.icon && <img src={wallet.adapter.icon} alt="" width={16} height={16} />}
        {shortAddress(address)}
      </button>
      {menu && (
        <div role="menu" className="panel absolute right-0 z-40 mt-2 grid w-52 gap-1 p-2 text-sm">
          <button
            role="menuitem"
            type="button"
            className="rounded-lg px-3 py-2 text-left hover:bg-lacquer/50"
            onClick={async () => {
              try { await navigator.clipboard.writeText(address); toast("Address copied"); } catch { toast(address); }
              setMenu(false);
            }}
          >
            Copy address
          </button>
          <button role="menuitem" type="button" className="rounded-lg px-3 py-2 text-left hover:bg-lacquer/50" onClick={() => { setMenu(false); openConnect(); }}>
            Change wallet
          </button>
          <button role="menuitem" type="button" className="rounded-lg px-3 py-2 text-left hover:bg-lacquer/50" onClick={() => { setMenu(false); void disconnect(); }}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

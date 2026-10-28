"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useConnectModal, useMintModal } from "./providers/Providers";

/**
 * The main call to action. Without a wallet it says "Connect wallet" and opens the wallet picker;
 * once connected it opens the mint modal. Falls back to the /mint page before JavaScript loads.
 */
export function MintTrigger({ className = "", children = "Mint a girl" }: { className?: string; children?: React.ReactNode }) {
  const { connected } = useWallet();
  const mint = useMintModal();
  const connect = useConnectModal();
  return (
    <a
      href="/mint"
      className={`btn ${className}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (connected) mint.open();
        else connect.open();
      }}
    >
      {connected ? children : "Connect wallet"}
    </a>
  );
}

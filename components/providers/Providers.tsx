"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletNotReadyError, type WalletError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { PUBLIC_RPC_URL } from "@/lib/config";
import { MintModal } from "@/components/mint/MintModal";
import { WalletPicker } from "@/components/wallet/WalletPicker";

export type SiteConfig = {
  mintCostAmc: number;
  distributionsEnabled: boolean;
};

const SiteConfigContext = createContext<SiteConfig>({ mintCostAmc: 100_000, distributionsEnabled: false });
export const useSiteConfig = () => useContext(SiteConfigContext);

const ToastContext = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

type Modal = { open: () => void; close: () => void };
const MintModalContext = createContext<Modal>({ open: () => {}, close: () => {} });
export const useMintModal = () => useContext(MintModalContext);

const ConnectModalContext = createContext<Modal>({ open: () => {}, close: () => {} });
/** Opens the wallet picker. */
export const useConnectModal = () => useContext(ConnectModalContext);

function connectErrorMessage(error: WalletError): string {
  if (error instanceof WalletNotReadyError) return "That wallet isn't installed in this browser.";
  const msg = `${error.message} ${(error.error as Error | undefined)?.message ?? ""}`;
  if (/reject|denied|cancel|closed/i.test(msg)) return "Connection cancelled in your wallet.";
  if (/locked|unlock/i.test(msg)) return "Unlock your wallet, then try again.";
  return "Couldn't connect to that wallet. Unlock it and try again.";
}

export function Providers({ config, children }: { config: SiteConfig; children: React.ReactNode }) {
  // Phantom and Solflare adapters are explicit so they can be offered before they're installed.
  // Backpack, OKX Wallet and every other Wallet Standard wallet register themselves when installed.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const onError = useCallback(
    (error: WalletError) => {
      console.warn("[wallet]", error.name, error.message);
      toast(connectErrorMessage(error));
    },
    [toast],
  );

  const [mintOpen, setMintOpen] = useState(false);
  const mint = useMemo(() => ({ open: () => setMintOpen(true), close: () => setMintOpen(false) }), []);
  const [connectOpen, setConnectOpen] = useState(false);
  const connect = useMemo(() => ({ open: () => setConnectOpen(true), close: () => setConnectOpen(false) }), []);

  return (
    <ConnectionProvider endpoint={PUBLIC_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <SiteConfigContext.Provider value={config}>
          <ToastContext.Provider value={toast}>
            <ConnectModalContext.Provider value={connect}>
              <MintModalContext.Provider value={mint}>
                {children}
                {mintOpen && <MintModal onClose={mint.close} />}
                {connectOpen && <WalletPicker onClose={connect.close} />}
                <div className="toast" role="status" aria-live="polite" hidden={!toastMsg}>
                  {toastMsg}
                </div>
              </MintModalContext.Provider>
            </ConnectModalContext.Provider>
          </ToastContext.Provider>
        </SiteConfigContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

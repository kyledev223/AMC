import Link from "next/link";
import { AMC_MINT, X_URL, solscan } from "@/lib/config";
import { Sigil } from "./Sigil";
import { CopyButton } from "./CopyButton";

export function Footer() {
  return (
    <footer className="mt-10 border-t-[1.5px] border-gold/25 pb-14 pt-10 text-sm text-ash">
      <div className="wrap">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-milk no-underline">
            <Sigil />
            Anime Milker Cult
          </Link>
          <div className="flex flex-wrap gap-5">
            {X_URL ? (
              <a href={X_URL} target="_blank" rel="noopener noreferrer" className="text-milk no-underline hover:text-gold">
                X
              </a>
            ) : (
              <span>X soon</span>
            )}
            <Link href="/docs" className="text-milk no-underline hover:text-gold">Docs</Link>
            <Link href="/docs#contracts" className="text-milk no-underline hover:text-gold">Contracts</Link>
          </div>
        </div>

        <div className="panel mt-7 flex flex-wrap items-center gap-3 py-3.5 pl-4.5 pr-3.5">
          <span className="text-gold-dim">CA</span>
          <code className="mono min-w-0 flex-[1_1_220px] text-milk [overflow-wrap:anywhere]">
            {AMC_MINT || "Contract address posts at launch"}
          </code>
          <CopyButton value={AMC_MINT} label="Copy contract" done="Contract copied" empty="Contract address posts at launch" className="btn-sm" />
          {AMC_MINT && (
            <a className="btn btn-ghost btn-sm" href={solscan("token", AMC_MINT)} target="_blank" rel="noopener noreferrer">
              View on Solscan
            </a>
          )}
        </div>

        <p className="mt-5 max-w-[60em]">
          Anime Milker Cult is a memecoin and a parody. It is not affiliated with, endorsed by or connected to AMC Entertainment Holdings, Inc. $AMC has no intrinsic value and no expectation of financial return. Nothing here is financial advice. All characters are fictional adults.
        </p>
      </div>
    </footer>
  );
}

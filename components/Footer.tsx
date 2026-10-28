import Link from "next/link";
import { X_URL } from "@/lib/config";
import { Sigil } from "./Sigil";

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
            <a href={X_URL} target="_blank" rel="noopener noreferrer" className="text-milk no-underline hover:text-gold">
              X
            </a>
            <Link href="/docs" className="text-milk no-underline hover:text-gold">Docs</Link>
          </div>
        </div>

        <p className="mt-5 max-w-[60em]">
          Anime Milker Cult is a memecoin and a parody. It is not affiliated with, endorsed by or connected to AMC Entertainment Holdings, Inc. $AMC has no intrinsic value and no expectation of financial return. Nothing here is financial advice. All characters are fictional adults.
        </p>
      </div>
    </footer>
  );
}

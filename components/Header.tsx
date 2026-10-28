"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sigil } from "./Sigil";
import { ConnectButton } from "./ConnectButton";
import { XButton } from "./XButton";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/my-girls", label: "My girls" },
  { href: "/payouts", label: "Payouts" },
  { href: "/stats", label: "Stats" },
  { href: "/docs", label: "Docs" },
];

export function Header() {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (fn: (o: boolean) => boolean) => setOpenOn(fn(open) ? pathname : null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="relative z-30">
      <div className="wrap flex items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-wide text-milk no-underline" aria-label="Anime Milker Cult home">
          <Sigil />
          $AMC
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`text-sm no-underline hover:text-milk ${isActive(n.href) ? "text-gold" : "text-ash"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <XButton className="btn-sm" />
          <ConnectButton />
          <button
            type="button"
            className="btn btn-ghost btn-sm lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="wrap pb-4 lg:hidden">
          <ul className="panel grid gap-1 p-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 no-underline hover:bg-lacquer/50 ${isActive(n.href) ? "text-gold" : "text-milk"}`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

import type { Metadata, Viewport } from "next";
import { Martian_Mono, UnifrakturMaguntia, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { env } from "@/lib/env";
import { SITE_URL } from "@/lib/config";

const display = UnifrakturMaguntia({ weight: "400", subsets: ["latin"], variable: "--f-display", display: "swap" });
const body = Zen_Kaku_Gothic_New({ weight: ["400", "500", "700", "900"], subsets: ["latin"], variable: "--f-body", display: "swap" });
const tape = Martian_Mono({ weight: ["400", "600"], subsets: ["latin"], variable: "--f-tape", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Anime Milker Cult", template: "%s · Anime Milker Cult" },
  description: "Burn $AMC to summon a girl. Her milk earns you a share of every fee.",
  openGraph: { images: ["/girls/priestess.webp"] },
};

export const viewport: Viewport = { themeColor: "#16090b", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = { mintCostAmc: env().MINT_COST_AMC, distributionsEnabled: env().DISTRIBUTIONS_ENABLED };
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${tape.variable}`}>
      <body>
        <Providers config={config}>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-sanctum">
            Skip to content
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

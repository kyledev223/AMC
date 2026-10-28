# Build: Anime Milker Cult ($AMC) — Mint a Girl

You are building a production-ready Next.js web app for **Anime Milker Cult ($AMC)**, a Solana memecoin. Users burn $AMC to mint a random anime girl NFT. Each girl produces "milk" (her output rate). Creator fees fill a reward pool, and every 10 minutes the pool is split between girl holders by their share of total milk output.

The game loop is modeled on mined.run (burn a token → mint a random rig NFT → rigs earn a share of creator fees by hashrate, paid every 10 minutes). Replace rigs with girls and hashrate with milk output.

Work through this in phases. Finish and verify each phase before starting the next. Ask me before making any decision that costs money, touches mainnet, or can't be undone.

---

## 0. Files provided

This folder contains:

- `design-reference/index.html` — the existing Anime Milker Cult landing page. **This is the design system.** Copy its palette, type, halo, ticker tape, and overall shrine feel. Don't invent a new look.
- `design-reference/img/*.webp` — the six girls (full size 800×1200, plus `-md` and `-sm` versions), transparent backgrounds.

Move the images into `public/girls/`. Keep the filenames.

---

## 1. Stack

- Next.js (App Router, latest stable), TypeScript strict, Tailwind CSS
- `@solana/web3.js`, `@solana/spl-token`, `@solana/wallet-adapter-react` + `-react-ui` + `-wallets` (Phantom, Solflare, Backpack)
- Metaplex Core (`@metaplex-foundation/mpl-core` + `umi`) for the NFT collection — one Core collection, one asset per girl
- Helius RPC + DAS API (`getAssetsByGroup`) to read holders and assets
- Postgres via Prisma (Neon or Supabase) for mints, snapshots, payouts and charts
- A scheduled worker for distributions (Vercel Cron hitting a protected route, or a small Node worker — pick one and explain why)
- Recharts for charts
- Deploy target: Vercel

Everything chain-related must run on **devnet by default**, switched by `NEXT_PUBLIC_SOLANA_CLUSTER`. Never default to mainnet.

---

## 2. Design system (port from `design-reference/index.html`)

Copy these tokens exactly into Tailwind's theme and a global CSS file:

```
--sanctum:   #16090b   ground
--sanctum-2: #22100f   raised surface
--lacquer:   #6a1520   robe red
--gold:      #d6b260   halo gold
--gold-dim:  #8f7440
--milk:      #f4ede3   main text
--ash:       #b29d97   secondary text
--up:        #4fbf68   green candle
--down:      #e2523f   red candle
```

Fonts (Google Fonts via `next/font/google`):
- Display: **UnifrakturMaguntia** — page titles and the big hero only
- Body: **Zen Kaku Gothic New** (400/500/700/900)
- Data/ticker: **Martian Mono** — numbers, addresses, the ticker tape

Reuse these signature pieces as components:
- `<Halo />` — the gold ring with conic rays behind the hero lineup
- `<TickerTape />` — the crawling band (respect `prefers-reduced-motion`)
- `<Sigil />` — the circled blackletter "A" logo mark
- Gold pill buttons (filled and ghost)

Rules: dark single theme, sentence-case copy, no all-caps labels, no emoji, mobile-first (must work at 380px with no horizontal scroll), visible keyboard focus, reduced motion respected.

---

## 3. The six girls (the "series")

Each girl is a series, like mined.run's WISP/SHADE/WRAITH/SPECTRE. Rarer girls produce more milk.

| Series id | Name | Title | Image | Series weight | Base milk (mL/s) |
|---|---|---|---|---|---|
| `trader` | Rena "Tickets" Akagi | The Floor Trader | trader.webp | 30% | 12,000 |
| `heiress` | Clementine Hollis | The Dairy Heiress | heiress.webp | 25% | 15,000 |
| `quant` | Dr. Shizuka Kuro | The Quant | quant.webp | 18% | 20,000 |
| `hunter` | Momo Kirisame | The Short Hunter | hunter.webp | 13% | 26,000 |
| `cfo` | Madame Veronica Kurenai | The CFO | cfo.webp | 9% | 34,000 |
| `priestess` | Sister Lumina | The High Priestess | priestess.webp | 5% | 48,000 |

Lore, quotes and facts for each girl are in `design-reference/index.html` (the `COUNCIL` array). Reuse them word for word.

### Tiers (the "frames")

Each girl comes in three tiers. Same art, different card treatment and output:

| Tier | Within-series weight | Milk multiplier | Card treatment |
|---|---|---|---|
| Devoted | 70% | 1× | Plain gold border |
| Gilded | 25% | 2.5× | Animated gold foil sheen |
| Divine | 5% | 6× | Holographic shimmer, halo behind her, glow |

That makes **18 possible mints**.

**Odds must be consistent.** Each mint's odds = series weight × tier weight (for example Priestess Divine = 5% × 5% = 0.25%). Generate the full 18-row odds table from one config file (`lib/girls.ts`) and write a unit test that asserts all 18 add up to exactly 100% and each series' rows add up to its series weight. (mined.run's published odds don't add up; ours must.)

Each minted girl also gets a serial number per series (e.g. "Sister Lumina #0042").

---

## 4. Pages and routes

Match mined.run's structure:

| Route | Purpose |
|---|---|
| `/` | Home: hero, network stats, the 18-card collection viewer, "Burn · mint · earn" explainer, milk output chart, recent payouts ledger |
| `/mint` | The mint flow (also reachable as a modal from anywhere) |
| `/my-girls` | Connected wallet's girls: card grid, each with tier, serial, milk rate, share of network, lifetime earnings |
| `/girl/[assetId]` | One minted girl: full art, lore, stats, owner, mint tx, payout history |
| `/payouts` | Global payout ledger, paginated, filterable by wallet |
| `/stats` | Network stats + charts: total milk output over time (1m/1h/6h/24h/7d), girls minted per series vs. odds, $AMC burned, pool size, payouts per epoch |
| `/docs` | How it works, odds table (generated from config), fee flow, FAQ, risks, contract addresses |

Header nav: Home, My girls, Payouts, Stats, Docs, plus a **Buy $AMC** button and a **Connect** wallet button. Footer: X link, CA with copy button and Solscan link, parody disclaimer (copy it from the reference page).

### Home sections in order
1. **Hero:** the six girls under the Halo (reuse the reference lineup), title "Anime Milker Cult", one line: "Burn $AMC to summon a girl. Her milk earns you a share of every fee." Buttons: Mint a girl, How it works.
2. **Ticker tape.**
3. **Network stats:** total milk output, girls minted, $AMC burned, total paid out, next distribution countdown.
4. **The collection:** carousel of all 18 cards with odds and milk rate. Cards tilt toward the cursor/finger with a parallax foil effect (this replaces mined.run's 3D orbit viewer). Divine cards get the holo shimmer.
5. **Burn · mint · earn:** three numbered steps (it is a real sequence).
6. **Milk output chart** with range tabs.
7. **Recent payouts** table (last 20).

Empty states everywhere: before launch every counter is 0 and tables say what will appear and when.

---

## 5. Mint flow

1. User connects a wallet. Show their $AMC balance.
2. Mint cost: `MINT_COST_AMC` (default 100,000 $AMC), shown clearly with "These $AMC are burned forever."
3. User clicks **Summon**. The server builds **one transaction** that:
   - burns `MINT_COST_AMC` from the user's $AMC token account (SPL `burn`, user signs)
   - creates a Metaplex Core asset in the collection, owned by the user (collection authority keypair co-signs on the server)
4. Randomness: server-side commit-reveal. Before each mint, the server publishes `sha256(serverSeed)`; the result is `hash(serverSeed + userWallet + recentBlockhash)` mapped onto the 18-row odds table. After the mint, reveal the seed on the girl's page so anyone can verify. Document this in `/docs`. (Note in the README that Switchboard or ORAO VRF is the upgrade path.)
5. The server verifies the transaction confirmed and the burn amount was correct before writing the mint to the database. Never trust the client.
6. **Reveal animation** — the one big motion moment of the site: the card spins face-down under the Halo, gold rays flare (stronger for Gilded, holo burst for Divine), then flips to reveal her name, tier, serial and milk rate. Skip straight to the result under reduced motion.
7. Buttons after reveal: View my girls, Summon again, Share on X (prefilled text with the girl's name and tier).

NFT metadata: name `"{Name} #{serial}"`, image URL from `public/girls/`, attributes `series`, `tier`, `milk_rate`, `serial`. Host metadata JSON at `/api/metadata/[assetId]`.

---

## 6. Rewards and distribution

- Creator fees from the $AMC token land in a **pool wallet** (`POOL_WALLET`).
- Every 10 minutes the worker:
  1. Reads the pool balance and keeps a gas reserve.
  2. Snapshots all girl NFTs in the collection and their owners via Helius DAS.
  3. Computes each wallet's share = their total milk ÷ network milk.
  4. Sends payouts in batches (skip dust under `MIN_PAYOUT`, carry it forward).
  5. Records the epoch, every payout and its tx signature in Postgres.
- No claim button and no lock-up. Payouts go straight to the wallet holding the girl.
- If a girl is sold, the new holder earns from the next epoch.
- Payout asset is configurable with `PAYOUT_ASSET`:
  - `SOL` (default, simplest)
  - `AMC_TOKENIZED` — buy tokenized AMC Entertainment stock (Backpack's `$AMC` or xStocks `AMCx` on Solana) with the pool and distribute that. **Build this as an option but leave it off.** Tokenized stocks are geo-restricted (not available to US persons, among others) and distributing them could make this a securities offering. Put a clear comment and a README warning that this needs legal review before it's enabled.
- Safety switches: `DISTRIBUTIONS_ENABLED=false` by default (show "Distributions start at launch" on the countdown), `DRY_RUN=true` mode that computes and logs payouts without sending, and an admin route (protected by a secret) to pause distributions.
- The worker must be idempotent: if it crashes mid-epoch it resumes without double-paying. Use a per-epoch lock in the database.

---

## 7. Data model (Prisma)

At minimum: `Mint` (assetId, owner, series, tier, serial, milkRate, burnTx, seedCommit, seedReveal, createdAt), `Epoch` (id, startedAt, poolAmount, totalMilk, status), `Payout` (epochId, wallet, amount, asset, txSig, status), `StatPoint` (timestamp, totalMilk, girls, burned, paidOut) for charts. Add indexes for wallet lookups.

---

## 8. Security and keys

- All secret keys (collection authority, pool wallet) live only in server env vars. Never ship them to the client, never log them.
- `.env.example` lists every variable with a comment. Real `.env` is gitignored.
- Rate-limit the mint API per wallet and IP.
- Validate every request with zod.
- The admin route and cron route check a secret header.

Env vars to include: `NEXT_PUBLIC_SOLANA_CLUSTER`, `NEXT_PUBLIC_RPC_URL`, `HELIUS_API_KEY`, `NEXT_PUBLIC_AMC_MINT`, `NEXT_PUBLIC_COLLECTION_ADDRESS`, `COLLECTION_AUTHORITY_SECRET`, `POOL_WALLET`, `POOL_WALLET_SECRET`, `MINT_COST_AMC`, `PAYOUT_ASSET`, `MIN_PAYOUT`, `DISTRIBUTIONS_ENABLED`, `DRY_RUN`, `CRON_SECRET`, `ADMIN_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_X_URL`, `NEXT_PUBLIC_BUY_URL`.

---

## 9. Scripts

- `scripts/create-devnet-token.ts` — makes a test $AMC SPL token on devnet and airdrops some to a test wallet
- `scripts/create-collection.ts` — creates the Metaplex Core collection and prints its address
- `scripts/simulate.ts` — mints N random girls on devnet and runs one dry-run epoch, printing the share table
- `scripts/odds.ts` — prints the 18-row odds table

---

## 10. Build phases

1. **Scaffold + design system:** Next.js, Tailwind tokens, fonts, layout, header/footer, Halo, TickerTape, all pages with static content and empty states. Check it at 380px and desktop.
2. **Girls config + collection viewer:** `lib/girls.ts`, odds test, 18 tilt cards with tier treatments, `/docs` odds table.
3. **Wallet + mint on devnet:** wallet connect, balance, server-built burn+mint transaction, commit-reveal, reveal animation, `/my-girls`, `/girl/[assetId]`.
4. **Distribution worker on devnet:** snapshots, share math, dry-run, then real devnet SOL payouts, `/payouts` and `/stats` charts.
5. **Hardening:** rate limits, idempotency, error states with clear messages, README with setup and a mainnet launch checklist.

At the end of each phase, run the app, check for console errors, and tell me what works and what's next.

---

## 11. Copy rules

- Plain, specific sentences in the Cult's voice. Buttons say exactly what happens: "Summon a girl", "Copy contract", "View on Solscan".
- Never promise profits. Say "share of fees", never "yield", "APY", "guaranteed" or "passive income".
- Keep the parody disclaimer in the footer: not affiliated with AMC Entertainment Holdings, no intrinsic value, not financial advice, all characters are fictional adults.

---

## 12. Don't

- Don't deploy anything to mainnet or spend real funds without asking me first.
- Don't use AMC Entertainment's real logo or branding.
- Don't add features beyond this spec without asking.

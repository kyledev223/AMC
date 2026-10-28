import type { Metadata } from "next";
import { ODDS_TABLE, SERIES, TIERS, formatPercent, tierMultiplier } from "@/lib/girls";
import { AMC_MINT, CLUSTER, COLLECTION_ADDRESS, EPOCH_SECONDS, solscan } from "@/lib/config";
import { env } from "@/lib/env";
import { formatInt, formatMilk } from "@/lib/format";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Docs", description: "How the Cult works: burn, mint, odds, fee flow, fairness and risks." };

const TOC = [
  ["how", "How it works"],
  ["odds", "Odds"],
  ["fees", "Fee flow"],
  ["fairness", "Fairness"],
  ["faq", "FAQ"],
  ["risks", "Risks"],
  ["contracts", "Contracts"],
] as const;

export default function DocsPage() {
  const e = env();
  const cost = formatInt(e.MINT_COST_AMC);
  const payoutAsset = e.PAYOUT_ASSET === "SOL" ? "SOL" : "tokenized AMC stock";

  const contracts: [string, string, "token" | "account"][] = [
    ["$AMC token", AMC_MINT, "token"],
    ["Girl collection (Metaplex Core)", COLLECTION_ADDRESS, "account"],
    ["Reward pool wallet", e.POOL_WALLET ?? "", "account"],
  ];

  return (
    <div className="wrap py-12 sm:py-16">
      <h1 className="page-title">How it works</h1>
      <p className="intro">Everything the Cult does, in order, with the numbers. If something here and the code disagree, the code wins and this page is wrong.</p>

      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
        {TOC.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="btn btn-ghost btn-sm">{label}</a>
        ))}
      </nav>

      <div className="prose-cult mt-12 grid max-w-[46em] gap-16">
        <section id="how" aria-labelledby="how-h" className="scroll-mt-6">
          <h2 id="how-h" className="room-title">How it works</h2>
          <ol className="steps">
            <li><div><h3>Connect a wallet holding $AMC</h3><p>Phantom, Solflare and Backpack all work.</p></div></li>
            <li><div><h3>Burn {cost} $AMC to summon a girl</h3><p>One transaction burns the $AMC from your wallet and mints the girl to it. If either part fails, neither happens.</p></div></li>
            <li><div><h3>She makes milk</h3><p>Each girl has a milk rate in mL/s, set by her series and tier. Rarer girls make more.</p></div></li>
            <li><div><h3>Every 10 minutes the pool is split</h3><p>Creator fees from $AMC trading collect in the pool wallet. Each distribution splits it between holders by their share of total milk output and sends it to their wallets.</p></div></li>
          </ol>
        </section>

        <section id="odds" aria-labelledby="odds-h" className="scroll-mt-6">
          <h2 id="odds-h" className="room-title">Odds</h2>
          <p className="mt-3">
            Each mint is one roll on 18 rows. A row&rsquo;s odds are its series weight times its tier weight. All 18 rows add up to exactly 100%, and a unit test checks that on every build.
          </p>
          <div className="panel mt-6 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Girl</th>
                  <th scope="col">Tier</th>
                  <th scope="col" className="num">Odds</th>
                  <th scope="col" className="num">Milk</th>
                </tr>
              </thead>
              <tbody>
                {ODDS_TABLE.map((r) => (
                  <tr key={r.key}>
                    <td className="text-milk">{r.series.name}<span className="block text-xs text-ash">{r.series.title}</span></td>
                    <td className={r.tier.id === "devoted" ? "text-ash" : "text-gold"}>{r.tier.name}</td>
                    <td className="num text-milk">{formatPercent(r.percent)}</td>
                    <td className="num text-milk">{formatMilk(r.milkRate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="font-bold text-milk">Total</td>
                  <td className="num font-bold text-milk">{formatPercent(ODDS_TABLE.reduce((s, r) => s + r.percent, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h3>Series</h3>
              <div className="panel overflow-x-auto">
                <table className="ledger">
                  <thead><tr><th scope="col">Girl</th><th scope="col" className="num">Weight</th><th scope="col" className="num">Base milk</th></tr></thead>
                  <tbody>
                    {SERIES.map((s) => (
                      <tr key={s.id}><td className="text-milk">{s.short}</td><td className="num">{s.weight}%</td><td className="num">{formatInt(s.baseMilk)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>Tiers</h3>
              <div className="panel overflow-x-auto">
                <table className="ledger">
                  <thead><tr><th scope="col">Tier</th><th scope="col" className="num">Weight</th><th scope="col" className="num">Milk</th></tr></thead>
                  <tbody>
                    {TIERS.map((t) => (
                      <tr key={t.id}><td className="text-milk">{t.name}<span className="block text-xs text-ash">{t.treatment}</span></td><td className="num">{t.weight}%</td><td className="num">{tierMultiplier(t)}&times;</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <p className="mt-4">Each girl also gets a serial number within her series, starting at #0001.</p>
        </section>

        <section id="fees" aria-labelledby="fees-h" className="scroll-mt-6">
          <h2 id="fees-h" className="room-title">Fee flow</h2>
          <ol className="steps">
            <li><div><h3>Trading fees land in the pool wallet</h3><p>The creator fee from $AMC trades is paid to the pool wallet listed under Contracts.</p></div></li>
            <li><div><h3>The worker takes a snapshot</h3><p>Every {EPOCH_SECONDS / 60} minutes it reads the pool balance, keeps a small reserve for transaction fees, and lists every girl in the collection with her current owner.</p></div></li>
            <li><div><h3>Shares are worked out by milk</h3><p>Your share is your girls&rsquo; total milk divided by the network&rsquo;s total milk. If you hold 2% of the milk, you receive 2% of that distribution.</p></div></li>
            <li><div><h3>{payoutAsset} is sent to each wallet</h3><p>No claim button and no lock-up. Amounts under the minimum ({e.MIN_PAYOUT} {e.PAYOUT_ASSET === "SOL" ? "SOL" : "units"}) are held for you and sent once they add up.</p></div></li>
          </ol>
          <p className="mt-6">
            If you sell a girl, the new holder earns from the next distribution. Every epoch, payout and transaction signature is recorded and shown on the <a href="/payouts">payouts page</a>.
          </p>
        </section>

        <section id="fairness" aria-labelledby="fair-h" className="scroll-mt-6">
          <h2 id="fair-h" className="room-title">Fairness</h2>
          <p className="mt-3">The roll uses commit-reveal, so the server can&rsquo;t change your girl after you sign.</p>
          <ol className="steps">
            <li><div><h3>Commit</h3><p>Before you sign, the server makes a secret seed and shows you <code>sha256(seed)</code>.</p></div></li>
            <li><div><h3>Roll</h3><p>The result is <code>sha256(seed + yourWallet + recentBlockhash)</code>, joined as plain text. The first 8 bytes, read as a number, modulo 10,000 pick the row: rows are laid end to end in the order of the odds table above.</p></div></li>
            <li><div><h3>Reveal</h3><p>After your mint confirms, the seed, blockhash and roll appear on your girl&rsquo;s page. Hash the seed to check it matches the commit, then redo the roll.</p></div></li>
          </ol>
          <p className="note mt-6">
            Commit-reveal stops the server from changing a result after you sign. It does not stop a dishonest server from choosing which blockhash to use. A verifiable random function (Switchboard or ORAO) removes that trust and is the planned upgrade.
          </p>
        </section>

        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-6">
          <h2 id="faq-h" className="room-title">FAQ</h2>
          <h3>Do I need to claim anything?</h3>
          <p>No. Payouts go straight to the wallet that holds the girl at the snapshot.</p>
          <h3>Can I sell my girl?</h3>
          <p>Yes. She&rsquo;s a normal Metaplex Core NFT. The new holder earns from the next distribution.</p>
          <h3>Why did I get nothing this epoch?</h3>
          <p>Either the pool was empty, or your share was under the minimum payout. Small amounts are held and sent once they add up.</p>
          <h3>Where does the burned $AMC go?</h3>
          <p>Nowhere. A burn removes the tokens from the supply. Nobody receives them.</p>
          <h3>Are the odds the same for everyone?</h3>
          <p>Yes. Same table for every wallet and every mint. Nothing about your wallet, history or balance changes them.</p>
        </section>

        <section id="risks" aria-labelledby="risks-h" className="scroll-mt-6">
          <h2 id="risks-h" className="room-title">Risks</h2>
          <ul>
            <li><strong>No promised return.</strong> Payouts are a share of trading fees. If nobody trades, the pool is empty and nobody is paid.</li>
            <li><strong>Burns are final.</strong> Burned $AMC can&rsquo;t be refunded, whichever girl you get.</li>
            <li><strong>Prices move.</strong> $AMC and the girls can lose all of their value.</li>
            <li><strong>Software can fail.</strong> The worker, the RPC provider or the chain can go down and delay distributions.</li>
            <li><strong>Trust.</strong> The pool wallet and collection authority are held by the team. The fairness note above explains what commit-reveal does and doesn&rsquo;t prove.</li>
          </ul>
          <p className="mt-4">This is a parody memecoin. Nothing here is financial advice.</p>
        </section>

        <section id="contracts" aria-labelledby="contracts-h" className="scroll-mt-6">
          <h2 id="contracts-h" className="room-title">Contracts</h2>
          <p className="mt-3">Network: Solana {CLUSTER}. Only these addresses are ours.</p>
          <div className="mt-6 grid gap-3">
            {contracts.map(([label, address, kind]) => (
              <div key={label} className="panel flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-[1_1_240px]">
                  <p className="text-sm text-gold-dim">{label}</p>
                  <code className="mono text-sm">{address || "Posts at launch"}</code>
                </div>
                <CopyButton value={address} label="Copy" done={`${label} copied`} className="btn-sm" />
                {address && (
                  <a className="btn btn-ghost btn-sm" href={solscan(kind, address)} target="_blank" rel="noopener noreferrer">View on Solscan</a>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

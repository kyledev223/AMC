import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PayoutsTable } from "@/components/PayoutsTable";
import { getPayoutsPage } from "@/lib/queries";
import { isPublicKey } from "@/lib/validate";
import { shortAddress } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts", description: "Every payout the Cult has sent, by epoch and wallet." };

const PAGE_SIZE = 50;
const params = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  wallet: z.string().trim().max(64).optional().catch(undefined),
});

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const { page, wallet: walletRaw } = params.parse({ page: raw.page, wallet: raw.wallet });
  const wallet = walletRaw || undefined;
  const walletValid = !wallet || isPublicKey(wallet);
  const { rows, total } = walletValid ? await getPayoutsPage({ page, pageSize: PAGE_SIZE, wallet }) : { rows: [], total: 0 };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/payouts?${new URLSearchParams({ ...(wallet ? { wallet } : {}), page: String(p) })}`;

  return (
    <div className="wrap py-12 sm:py-16">
      <h1 className="page-title">Payouts</h1>
      <p className="intro">Every payout from every distribution, newest first. Each one links to its transaction on Solscan.</p>

      <form className="mt-8 flex max-w-[640px] flex-wrap gap-2" action="/payouts" method="get" role="search">
        <label htmlFor="wallet" className="sr-only">Filter by wallet address</label>
        <input id="wallet" name="wallet" className="field min-w-0 flex-[1_1_260px]" placeholder="Filter by wallet address" defaultValue={wallet ?? ""} autoComplete="off" spellCheck={false} />
        <button className="btn" type="submit">Filter</button>
        {wallet && <Link className="btn btn-ghost" href="/payouts">Clear</Link>}
      </form>

      {!walletValid && <p className="mt-4 text-sm text-down" role="alert">That isn&rsquo;t a valid Solana address. Check it and try again.</p>}

      {walletValid && (
        <p className="mt-6 text-sm text-ash">
          {total.toLocaleString("en-US")} payout{total === 1 ? "" : "s"}
          {wallet ? <> to <span className="mono text-milk">{shortAddress(wallet, 6)}</span></> : null}
        </p>
      )}

      <PayoutsTable
        rows={rows}
        empty={
          wallet
            ? "No payouts to this wallet yet. A wallet is paid in the first distribution after it holds a girl, once its share clears the minimum payout."
            : "Payouts will be listed here, newest first. The first distribution runs after launch, then one every 10 minutes."
        }
      />

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-3">
          {page > 1 ? <Link className="btn btn-ghost btn-sm" href={href(page - 1)}>Newer</Link> : <span />}
          <span className="mono text-sm text-ash">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn btn-ghost btn-sm" href={href(page + 1)}>Older</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

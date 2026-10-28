import Link from "next/link";
import type { PayoutRow } from "@/lib/queries";
import { formatUnits, formatDateTime } from "@/lib/format";
import { shortAddress, solscan } from "@/lib/config";

export function PayoutsTable({ rows, empty }: { rows: PayoutRow[]; empty: React.ReactNode }) {
  if (rows.length === 0) {
    return <div className="note mt-6">{empty}</div>;
  }
  return (
    <div className="panel mt-6 overflow-x-auto">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Epoch</th>
            <th scope="col">Wallet</th>
            <th scope="col" className="num">Amount</th>
            <th scope="col" className="hidden sm:table-cell">Time</th>
            <th scope="col">Tx</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="mono text-ash">{p.epochId}</td>
              <td>
                <Link href={`/payouts?wallet=${p.wallet}`} className="mono text-milk no-underline hover:text-gold">
                  {shortAddress(p.wallet)}
                </Link>
              </td>
              <td className="num text-milk">
                {formatUnits(p.amount, p.decimals, 6)} <span className="text-ash">{p.asset === "SOL" ? "SOL" : "AMCx"}</span>
              </td>
              <td className="hidden whitespace-nowrap text-ash sm:table-cell">{formatDateTime(p.createdAt)}</td>
              <td>
                {p.status === "dry_run" ? (
                  <span className="text-ash">Dry run</span>
                ) : p.txSig ? (
                  <a href={solscan("tx", p.txSig)} target="_blank" rel="noopener noreferrer" className="mono no-underline">
                    {shortAddress(p.txSig)}
                  </a>
                ) : (
                  <span className="text-ash">Pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

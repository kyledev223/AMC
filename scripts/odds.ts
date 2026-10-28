/** Prints the 18-row odds table from lib/girls.ts. */
import { ODDS_DENOMINATOR, ODDS_TABLE, formatPercent } from "../lib/girls";

const rows = ODDS_TABLE.map((r) => ({
  girl: r.series.name,
  tier: r.tier.name,
  odds: formatPercent(r.percent),
  "milk (mL/s)": r.milkRate.toLocaleString("en-US"),
}));
console.table(rows);
const total = ODDS_TABLE.reduce((s, r) => s + r.weight, 0);
console.log(`Total: ${formatPercent((total / ODDS_DENOMINATOR) * 100)} (${total}/${ODDS_DENOMINATOR})`);
if (total !== ODDS_DENOMINATOR) process.exit(1);

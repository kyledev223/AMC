import Link from "next/link";
import { getSeries, girlImage, type SeriesId } from "@/lib/girls";
import { Sun } from "./Sun";

/** Priestess and CFO front and center, as on the reference page. */
const POSITIONS: [SeriesId, string][] = [
  ["priestess", "c1"],
  ["cfo", "c2"],
  ["quant", "m1"],
  ["trader", "m2"],
  ["hunter", "o1"],
  ["heiress", "o2"],
];

export function HeroLineup() {
  return (
    <div className="lineup">
      <Sun />
      {POSITIONS.map(([id, pos]) => {
        const s = getSeries(id)!;
        return (
          <Link key={id} href="/docs#odds" className="lineup-girl" data-pos={pos} aria-label={`${s.name}, ${s.title}. See her odds`}>
            <img src={girlImage(s, "md")} alt="" width={480} height={720} fetchPriority={pos.startsWith("c") ? "high" : "auto"} />
          </Link>
        );
      })}
    </div>
  );
}

type Item = [label: string, dir: "u" | "d", value: string];

const DEFAULT_TAPE: Item[] = [
  ["$AMC", "u", "HOLD"], ["MILK", "u", "FRESH"], ["SHORTS", "d", "LIQUIDATED"],
  ["PAPER HANDS", "d", "EXCOMMUNICATED"], ["TENDIES", "u", "SERVED"], ["COPE", "d", "DUMPED"],
  ["FAITH", "u", "UNSHAKEN"], ["RED CANDLES", "d", "SLICED"], ["COUNCIL", "u", "IN SESSION"],
];

/** The crawling band. The track is doubled for a seamless loop; CSS stops it under reduced motion. */
export function TickerTape({ items = DEFAULT_TAPE }: { items?: Item[] }) {
  const row = (pass: string) =>
    items.map(([k, dir, v], i) => (
      <span key={`${pass}${i}`}>
        <b>{k}</b> <span className={dir}>{dir === "u" ? "▲" : "▼"} {v}</span>
      </span>
    ));
  return (
    <div className="tape" aria-hidden="true">
      <div className="tape-track">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

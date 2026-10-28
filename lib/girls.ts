/**
 * The single source of truth for the six series, the three tiers and the 18-row odds table.
 * Weights are integers so the table sums exactly: series weights are in percent, tier weights
 * are in percent, and each row's weight is in basis points of a basis point (1/10,000).
 */

export const SERIES_IDS = ["trader", "heiress", "quant", "hunter", "cfo", "priestess"] as const;
export type SeriesId = (typeof SERIES_IDS)[number];

export const TIER_IDS = ["devoted", "gilded", "divine"] as const;
export type TierId = (typeof TIER_IDS)[number];

export type Series = {
  id: SeriesId;
  name: string;
  /** Shorter name for tight spots such as card footers. */
  short: string;
  title: string;
  rank: string;
  image: string;
  /** Percent of all mints. */
  weight: number;
  /** mL/s before the tier multiplier. */
  baseMilk: number;
  quote: string;
  lore: string;
  facts: [string, string][];
  alt: string;
};

export type Tier = {
  id: TierId;
  name: string;
  /** Percent within a series. */
  weight: number;
  /** Multiplier as a fraction (numerator / 2) so 2.5x stays an integer. */
  multiplier: number;
  treatment: string;
};

export const SERIES: readonly Series[] = [
  {
    id: "trader",
    name: "Rena “Tickets” Akagi",
    short: "Rena Akagi",
    title: "The Floor Trader",
    rank: "Floor Captain",
    image: "trader",
    weight: 30,
    baseMilk: 12_000,
    quote: "Sell button? Never heard of her.",
    lore: "Badge 420 has been on the floor since the first meme-stock squeeze. Rena only prints buy tickets, shouts every order herself and keeps three phones on her at all times in case one of them stops believing.",
    facts: [["Domain", "Order flow and noise"], ["Carries", "A fistful of buy tickets"], ["Hates", "Halted trading"]],
    alt: "The Floor Trader shouting into a phone with a fistful of buy tickets",
  },
  {
    id: "heiress",
    name: "Clementine Hollis",
    short: "Clementine",
    title: "The Dairy Heiress",
    rank: "Quartermaster",
    image: "heiress",
    weight: 25,
    baseMilk: 15_000,
    quote: "Every bottle's a share of the herd, sugar.",
    lore: "Clementine inherited the biggest dairy ranch west of Wall Street and gave the Cult its name. She supplies the milk, stamps every bottle with the sigil and personally delivers a crate to each new member.",
    facts: [["Domain", "Supply and sustenance"], ["Carries", "A crate of AMC milk"], ["Hates", "Spoiled bags"]],
    alt: "The Dairy Heiress holding a crate of AMC milk bottles",
  },
  {
    id: "quant",
    name: "Dr. Shizuka Kuro",
    short: "Shizuka Kuro",
    title: "The Quant",
    rank: "Head of Research",
    image: "quant",
    weight: 18,
    baseMilk: 20_000,
    quote: "My model has one output. Up.",
    lore: "Shizuka built a risk model so elegant it only ever returns a buy signal. She calls it rigorous. Everyone else calls it faith with equations. Either way, the charts float around her when she's thinking.",
    facts: [["Domain", "Charts and conviction"], ["Carries", "Holographic order books"], ["Hates", "Volatility skeptics"]],
    alt: "The Quant surrounded by floating holographic charts",
  },
  {
    id: "hunter",
    name: "Momo Kirisame",
    short: "Momo Kirisame",
    title: "The Short Hunter",
    rank: "Enforcer",
    image: "hunter",
    weight: 13,
    baseMilk: 26_000,
    quote: "It's not like I liquidated them for you. Baka.",
    lore: "Momo patrols the order book with a katana and a short temper. Every red candle that rises against the Cult gets cut in half. She insists she does it for fun and turns pink if you thank her.",
    facts: [["Domain", "Shorts and stop hunts"], ["Carries", "A green-edged katana"], ["Hates", "Red candles"]],
    alt: "The Short Hunter holding a green-edged katana",
  },
  {
    id: "cfo",
    name: "Madame Veronica Kurenai",
    short: "Veronica Kurenai",
    title: "The CFO",
    rank: "Treasurer",
    image: "cfo",
    weight: 9,
    baseMilk: 34_000,
    quote: "I've reviewed your trades. We need to talk.",
    lore: "Veronica keeps the books, and the books keep score. She has a clipboard for every member, a red pen for every bad entry, and a fresh coffee for the day she finally sees one green week from you.",
    facts: [["Domain", "Treasury and tendies"], ["Carries", "Your losing trades"], ["Hates", "Buying the top"]],
    alt: "The CFO holding a clipboard and a red pen",
  },
  {
    id: "priestess",
    name: "Sister Lumina",
    short: "Sister Lumina",
    title: "The High Priestess",
    rank: "Founder",
    image: "priestess",
    weight: 5,
    baseMilk: 48_000,
    quote: "Hold, and you shall be fed.",
    lore: "She saw a green candle in a dream and woke up with a ticker carved into her chalice. Lumina wrote the Cult's one commandment: never sell. She pours the milk at every gathering and remembers every wallet that left.",
    facts: [["Domain", "Doctrine and diamond hands"], ["Carries", "The golden chalice"], ["Hates", "Paper hands"]],
    alt: "The High Priestess raising a golden chalice",
  },
];

export const TIERS: readonly Tier[] = [
  { id: "devoted", name: "Devoted", weight: 70, multiplier: 2, treatment: "Plain gold border" },
  { id: "gilded", name: "Gilded", weight: 25, multiplier: 5, treatment: "Animated gold foil sheen" },
  { id: "divine", name: "Divine", weight: 5, multiplier: 12, treatment: "Holographic shimmer, halo and glow" },
];

/** Total weight of the odds table. Every row weight is out of this. */
export const ODDS_DENOMINATOR = 10_000;

export type OddsRow = {
  key: `${SeriesId}:${TierId}`;
  series: Series;
  tier: Tier;
  /** Out of ODDS_DENOMINATOR. */
  weight: number;
  /** Percent, for display. */
  percent: number;
  milkRate: number;
};

export function milkRate(series: Series, tier: Tier): number {
  return (series.baseMilk * tier.multiplier) / 2;
}

export function tierMultiplier(tier: Tier): number {
  return tier.multiplier / 2;
}

/** All 18 rows, ordered by series (common first) then tier (common first). */
export const ODDS_TABLE: readonly OddsRow[] = SERIES.flatMap((series) =>
  TIERS.map((tier) => {
    const weight = series.weight * tier.weight;
    return {
      key: `${series.id}:${tier.id}` as const,
      series,
      tier,
      weight,
      percent: weight / 100,
      milkRate: milkRate(series, tier),
    };
  }),
);

export function getSeries(id: string): Series | undefined {
  return SERIES.find((s) => s.id === id);
}

export function getTier(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function getRow(seriesId: string, tierId: string): OddsRow | undefined {
  return ODDS_TABLE.find((r) => r.series.id === seriesId && r.tier.id === tierId);
}

/**
 * Maps a uniform integer in [0, ODDS_DENOMINATOR) onto the odds table.
 * Rows are laid end to end in table order.
 */
export function rowForTicket(ticket: number): OddsRow {
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= ODDS_DENOMINATOR) {
    throw new RangeError(`ticket must be an integer in [0, ${ODDS_DENOMINATOR})`);
  }
  let acc = 0;
  for (const row of ODDS_TABLE) {
    acc += row.weight;
    if (ticket < acc) return row;
  }
  throw new Error("Odds table does not cover the full range");
}

export function girlImage(series: Series | SeriesId, size: "full" | "md" | "sm" = "full"): string {
  const id = typeof series === "string" ? series : series.image;
  return `/girls/${id}${size === "full" ? "" : `-${size}`}.webp`;
}

export function displayName(series: Series, serial: number): string {
  return `${series.name} #${String(serial).padStart(4, "0")}`;
}

export function formatPercent(p: number): string {
  return `${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

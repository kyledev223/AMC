# Anime Milker Cult ($AMC): mint a girl

Burn $AMC to mint a random anime girl NFT (Metaplex Core). Each girl has a milk rate. Creator fees collect in a pool wallet, and every 10 minutes the pool is split between holders by their share of total milk.

Everything runs on **Solana devnet by default** (`NEXT_PUBLIC_SOLANA_CLUSTER`). Nothing here touches mainnet unless you change that variable.

## Stack

Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, `@solana/web3.js` 1.x, SPL Token, wallet adapter (Phantom, Solflare, and Backpack through Wallet Standard), Metaplex Core + Umi, Helius RPC and DAS, Postgres through Prisma 7, Recharts, Vitest. Deploys to Vercel.

## Setup

```bash
npm install
cp .env.example .env          # then fill it in; every variable is documented there
npx prisma migrate deploy     # needs DATABASE_URL
npm run dev
```

A local Postgres for development:

```bash
docker run -d --name amc-postgres -e POSTGRES_USER=amc -e POSTGRES_PASSWORD=amc -e POSTGRES_DB=amc -p 54329:5432 postgres:17-alpine
# DATABASE_URL=postgresql://amc:amc@localhost:54329/amc
```

Without `DATABASE_URL` the site still renders, with every counter at zero and empty states.

## Devnet walkthrough

The devnet RPC faucet is closed, so test SOL comes from https://faucet.solana.com.

1. `npm run devnet:token` creates `.keys/devnet-payer.json` and stops if the payer has no SOL. Fund the printed address at the faucet (2–5 SOL) and run it again. It creates a test $AMC mint (6 decimals), sends 10,000,000 to the payer and writes `NEXT_PUBLIC_AMC_MINT` to `.env`.
   To send test $AMC to your own browser wallet: `npm run devnet:token -- <your wallet> 1000000`.
2. `npm run devnet:collection` creates the Core collection, saves the authority key in `.keys/` and writes `NEXT_PUBLIC_COLLECTION_ADDRESS` and `COLLECTION_AUTHORITY_SECRET` to `.env`.
3. Restart `npm run dev`, connect a devnet wallet holding test $AMC and a little SOL, and summon.
4. `npm run simulate -- 6` mints 6 girls across 3 test wallets through the real server mint path, then runs a dry-run epoch and prints the share table.
5. `npm run simulate -- 0 --pay` sends a real devnet SOL distribution from a test pool wallet (`.keys/pool.json`, topped up to 0.3 SOL to stand in for creator fees).

`npm run odds` prints the 18-row odds table.

Keys created by scripts live in `.keys/`, which is gitignored. Scripts write secrets to `.env` and never print them.

## How it works

### Odds

`lib/girls.ts` holds the six series, the three tiers and the 18-row table. Row weight = series weight × tier weight, in units of 1/10,000, so the table sums exactly to 100%. `tests/odds.test.ts` checks the total, each series' total and the mapping from roll to row.

### Mint flow

1. `POST /api/mint/commit`: the server makes a secret seed and returns `sha256(seed)` before anything is signed.
2. `POST /api/mint/prepare`: the server reads a recent blockhash, rolls `sha256(seed + wallet + blockhash)`, reserves the next serial in that series and builds **one transaction**: SPL `burnChecked` of `MINT_COST_AMC` (the user signs) plus Core `createV1` into the collection (the collection authority and the new asset key co-sign on the server).
   The on-chain name is `Sealed AMC girl` and the metadata stays sealed until confirmation. Otherwise a user could read the result in the wallet's transaction preview and refuse to sign anything except a Divine.
3. The wallet signs and the client sends the signed transaction to `POST /api/mint/confirm`. The server checks the message hash matches what it built, submits it, waits for confirmation, then re-reads the transaction from chain and verifies the exact burn amount, mint and signer. It also checks the asset exists, is owned by the user and belongs to the collection. Only then does it write the `Mint` row.
4. After that, the server renames the asset on chain to `{Name} #{serial}` with the collection authority. This is best effort; the metadata JSON at `/api/metadata/[assetId]` already carries the name.
5. If a confirm request dies after submission, the cron run recovers it (`reconcilePendingMints`).

The seed is revealed on `/girl/[assetId]` with every input, so anyone can redo the roll.

**Upgrade path:** commit-reveal stops the server changing a result after you sign, but a dishonest server could still choose which blockhash to roll against. Switchboard On-Demand randomness or ORAO VRF removes that trust and is the planned upgrade.

### Distributions

**Choice: Vercel Cron hitting `/api/cron/distribute`** (see `vercel.json`, `*/10 * * * *`). Why:

- The deploy target is already Vercel, so this needs no second service, host, deploy pipeline or set of secrets.
- The worker is written as an idempotent, resumable function, so a short-lived serverless invocation is enough. Each run stops starting new batches after 240s and the next run resumes.
- Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

Trade-offs: a 10-minute schedule needs the **Vercel Pro** plan (Hobby cron runs once a day) and `maxDuration = 300` also needs Pro. If you'd rather not pay for Pro, any scheduler that can `curl` the route with the secret every 10 minutes works unchanged (GitHub Actions, a small VPS cron).

Each run:

1. Records any mints left half-confirmed.
2. Finishes any earlier epoch still paying, before reading the pool, so unsent payouts are never counted twice.
3. Takes the epoch lock (`Epoch.id = floor(unix / 600)`, compare-and-set on `lockedUntil`).
4. Reads the pool balance minus `GAS_RESERVE_SOL` and minus dust still owed to wallets.
5. Snapshots every girl and owner through Helius DAS `getAssetsByGroup`, or `getProgramAccounts` without a Helius key.
6. Computes shares (`lib/shares.ts`: pure bigint math, rounding down, never more than the pool). Wallets owed less than `MIN_PAYOUT` carry it forward in `Carry`.
7. Saves the whole plan (`Share`, `Payout` rows as `pending`, new carries) in one database transaction.
8. Sends in batches of 18 transfers. **Each batch's signature and last valid block height are written to the database before broadcast.** On resume, a batch in `sending` is marked sent if its signature landed. It is re-sent only once its blockhash has expired without landing, which means it can never land later. A payout that fails 5 times moves into the wallet's carry, so it is paid later rather than lost.

`tests/distribute.int.test.ts` runs these crash cases against a real Postgres with a fake chain: a batch that landed but whose response was lost, a batch lost before landing, and two concurrent runs. Run it with `TEST_DATABASE_URL=postgresql://... npm test`. It **wipes** that database.

Safety switches:

- `DISTRIBUTIONS_ENABLED=false` (default): nothing runs, and the countdown says "Distributions start at launch".
- `DRY_RUN=true` (default): computes and records payouts as `dry_run` without sending.
- `POST /api/admin/pause` with header `x-admin-secret: $ADMIN_SECRET` and body `{"paused": true}` pauses without a redeploy. `GET` on the same route shows the current switches.

### ⚠️ `PAYOUT_ASSET=AMC_TOKENIZED` needs legal review

This option swaps the pool's SOL into tokenized AMC Entertainment stock (Backpack's $AMC or xStocks' AMCx on Solana) through Jupiter and distributes that instead of SOL. It is built and **off**. Tokenized stocks are geo-restricted (not available to US persons, among others), and distributing them to anonymous wallets as a reward for holding an NFT could make this a securities offering. **Do not enable it without a written legal opinion.** On mainnet the worker refuses to run it unless `TOKENIZED_PAYOUTS_LEGAL_REVIEWED=true` is also set. It needs `PAYOUT_TOKEN_MINT`, and the swap only works on mainnet.

## Security

- Secrets (`COLLECTION_AUTHORITY_SECRET`, `POOL_WALLET_SECRET`, `CRON_SECRET`, `ADMIN_SECRET`) are read only in `lib/env.ts` and `lib/solana.ts`, which import `server-only`. They are never sent to the client or logged.
- Every API input is validated with zod.
- Mint routes are rate-limited per wallet and per IP through a Postgres-backed fixed window, so limits hold across serverless instances.
- Cron and admin routes compare secrets in constant time.
- The server never trusts the client: it builds the transaction, checks the signed copy is byte-identical, submits it itself and verifies the result on chain.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (odds, fairness, share math), plus the DB integration test when `TEST_DATABASE_URL` is set |
| `npm run typecheck` / `npm run lint` | Types and lint |
| `npm run odds` | Print the 18-row odds table |
| `npm run devnet:token` | Test $AMC on devnet |
| `npm run devnet:collection` | Core collection on devnet |
| `npm run simulate -- N [--pay]` | Mint N girls on devnet, then one dry-run (or real devnet) epoch |

## Mainnet launch checklist

Do not start this without the owner's sign-off. Every step that spends money or touches mainnet is theirs to approve.

1. [ ] Legal review of the parody, the disclaimer and the reward mechanism. Tokenized payouts stay off unless separately cleared.
2. [ ] Postgres on Neon or Supabase (pooled URL), `npx prisma migrate deploy`, backups on.
3. [ ] Helius mainnet API key. Set `NEXT_PUBLIC_RPC_URL` to a browser-safe RPC (domain-restricted key).
4. [ ] Fresh collection authority and pool keypairs generated offline, never reused from devnet. Store them in Vercel env only. Consider a hardware wallet or multisig as the pool's long-term home, sweeping from the hot payout wallet.
5. [ ] Create the mainnet Core collection with the authority (port `scripts/create-collection.ts`; it refuses to run off devnet on purpose). Fund the authority with ~0.5 SOL for reveal renames.
6. [ ] Set the token's creator fee recipient to `POOL_WALLET` and confirm the first fees land.
7. [ ] Set `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`, `NEXT_PUBLIC_AMC_MINT`, `NEXT_PUBLIC_COLLECTION_ADDRESS`, `NEXT_PUBLIC_SITE_URL` (final domain: it is baked into every NFT's metadata URI), `MINT_COST_AMC`, `MIN_PAYOUT`, `GAS_RESERVE_SOL`.
8. [ ] Long random `CRON_SECRET` and `ADMIN_SECRET`. Vercel Pro is on and the cron shows in the dashboard.
9. [ ] Deploy with `DISTRIBUTIONS_ENABLED=false`. Do one real mint with a team wallet, then check the burn on Solscan, the girl page, the metadata JSON and the on-chain rename.
10. [ ] Set `DISTRIBUTIONS_ENABLED=true` with `DRY_RUN=true` and watch several epochs. Compare the dry-run payouts with a manual calculation.
11. [ ] Set `DRY_RUN=false`. Watch the first live epoch's transactions on Solscan. Keep the admin pause command ready.
12. [ ] Set up alerting on cron failures (Vercel logs or a log drain) and on the pool or authority balance running low.

## Notes

- The images in `public/girls/` are copied from `design-reference/img/`. The reference folder is kept so `design-reference/index.html` still opens.
- This folder is inside OneDrive. `node_modules` and `.next` sync poorly, so consider moving the project out of OneDrive or excluding those folders.
- The "1m" chart range is read as one minute, in line with the other ranges (1h, 6h, 24h, 7d).

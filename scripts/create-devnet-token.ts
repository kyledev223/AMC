/**
 * Makes a test $AMC SPL token on devnet and sends some to a test wallet.
 *   npm run devnet:token                     -> mints to the payer (.keys/devnet-payer.json)
 *   npm run devnet:token -- <wallet> [amount] -> mints to your wallet (default 10,000,000 AMC)
 * Writes NEXT_PUBLIC_AMC_MINT into .env.
 */
import { PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assertDevnet, connection, ensureSol, keypair, setEnv } from "./_shared";

const DECIMALS = 6;

async function main() {
  assertDevnet();
  const conn = connection();
  const payer = keypair("devnet-payer");
  await ensureSol(conn, payer.publicKey, 1);

  const to = process.argv[2] ? new PublicKey(process.argv[2]) : payer.publicKey;
  const amount = BigInt(process.argv[3] ?? "10000000");

  let mint: PublicKey;
  if (process.env.NEXT_PUBLIC_AMC_MINT) {
    mint = new PublicKey(process.env.NEXT_PUBLIC_AMC_MINT);
    console.log(`Using existing test $AMC mint ${mint.toBase58()}`);
  } else {
    mint = await createMint(conn, payer, payer.publicKey, null, DECIMALS);
    setEnv("NEXT_PUBLIC_AMC_MINT", mint.toBase58());
    console.log(`Created test $AMC mint ${mint.toBase58()} (${DECIMALS} decimals), saved to .env`);
  }

  const ata = await getOrCreateAssociatedTokenAccount(conn, payer, mint, to);
  await mintTo(conn, payer, mint, ata.address, payer, amount * 10n ** BigInt(DECIMALS));
  console.log(`Sent ${amount.toLocaleString("en-US")} test $AMC to ${to.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

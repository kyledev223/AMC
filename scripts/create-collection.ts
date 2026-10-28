/**
 * Creates the Metaplex Core collection on devnet and prints its address.
 * The collection authority key is kept in .keys/collection-authority.json and written to .env
 * (COLLECTION_AUTHORITY_SECRET) along with NEXT_PUBLIC_COLLECTION_ADDRESS. It is never printed.
 */
import { createCollectionV1, mplCore } from "@metaplex-foundation/mpl-core";
import { createSignerFromKeypair, generateSigner, signerIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { assertDevnet, connection, ensureSol, keyFile, keypair, rpcUrl, setEnv } from "./_shared";

async function main() {
  assertDevnet();
  const conn = connection();
  const payer = keypair("devnet-payer");
  await ensureSol(conn, payer.publicKey, 1);
  const authority = keypair("collection-authority");
  // The authority pays for the reveal rename after each mint.
  await ensureSol(conn, authority.publicKey, 0.2, payer);

  if (process.env.NEXT_PUBLIC_COLLECTION_ADDRESS && !process.argv.includes("--new")) {
    console.log(`Collection already set: ${process.env.NEXT_PUBLIC_COLLECTION_ADDRESS}. Pass --new to make another.`);
    return;
  }

  const umi = createUmi(rpcUrl(), { commitment: "confirmed" }).use(mplCore());
  umi.use(signerIdentity(createSignerFromKeypair(umi, fromWeb3JsKeypair(authority))));
  const collection = generateSigner(umi);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

  await createCollectionV1(umi, {
    collection,
    name: "Anime Milker Cult",
    uri: `${site}/api/metadata/collection`,
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

  setEnv("NEXT_PUBLIC_COLLECTION_ADDRESS", collection.publicKey.toString());
  setEnv("COLLECTION_AUTHORITY_SECRET", keyFile("collection-authority"));
  console.log(`Collection: ${collection.publicKey.toString()}`);
  console.log(`Authority:  ${authority.publicKey.toBase58()}`);
  console.log("Saved NEXT_PUBLIC_COLLECTION_ADDRESS and COLLECTION_AUTHORITY_SECRET to .env. Restart the dev server to pick them up.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

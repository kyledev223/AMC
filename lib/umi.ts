import "server-only";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore } from "@metaplex-foundation/mpl-core";
import { createSignerFromKeypair, signerIdentity, type Umi } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import type { Keypair } from "@solana/web3.js";
import { serverRpcUrl } from "./env";

let base: Umi | undefined;

/** Read-only Umi with the Core program registered. */
export function getUmi(): Umi {
  base ??= createUmi(serverRpcUrl(), { commitment: "confirmed" }).use(mplCore());
  return base;
}

/** Umi that signs and pays as the given keypair. */
export function umiAs(keypair: Keypair): Umi {
  const umi = createUmi(serverRpcUrl(), { commitment: "confirmed" }).use(mplCore());
  return umi.use(signerIdentity(createSignerFromKeypair(umi, fromWeb3JsKeypair(keypair))));
}

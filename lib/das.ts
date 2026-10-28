import "server-only";
import { fetchAssetsByCollection, fetchAssetsByOwner } from "@metaplex-foundation/mpl-core";
import { COLLECTION_ADDRESS } from "./config";
import { ConfigError, env, serverRpcUrl } from "./env";
import { getUmi } from "./umi";

/** An asset in the collection and who holds it right now. */
export type Holder = { assetId: string; owner: string; burnt: boolean };

type DasAsset = {
  id: string;
  burnt?: boolean;
  ownership: { owner: string };
  grouping?: { group_key: string; group_value: string }[];
};

async function das<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(serverRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`DAS ${method} HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error || !body.result) throw new Error(`DAS ${method}: ${body.error?.message ?? "no result"}`);
  return body.result;
}

const PAGE = 1000;

/**
 * Every girl in the collection with her current owner.
 * Uses Helius DAS when HELIUS_API_KEY is set, otherwise falls back to getProgramAccounts.
 */
export async function snapshotCollection(): Promise<Holder[]> {
  if (!COLLECTION_ADDRESS) throw new ConfigError("NEXT_PUBLIC_COLLECTION_ADDRESS is not set");
  if (env().HELIUS_API_KEY) {
    const out: Holder[] = [];
    for (let page = 1; ; page++) {
      const r = await das<{ items: DasAsset[]; total: number }>("getAssetsByGroup", {
        groupKey: "collection",
        groupValue: COLLECTION_ADDRESS,
        page,
        limit: PAGE,
      });
      out.push(...r.items.map((a) => ({ assetId: a.id, owner: a.ownership.owner, burnt: Boolean(a.burnt) })));
      if (r.items.length < PAGE) break;
    }
    return out;
  }
  const assets = await fetchAssetsByCollection(getUmi(), COLLECTION_ADDRESS, { skipDerivePlugins: true });
  return assets.map((a) => ({ assetId: a.publicKey.toString(), owner: a.owner.toString(), burnt: false }));
}

/** The asset ids in our collection held by a wallet. */
export async function assetsOwnedBy(owner: string): Promise<string[]> {
  if (!COLLECTION_ADDRESS) return [];
  if (env().HELIUS_API_KEY) {
    const ids: string[] = [];
    for (let page = 1; ; page++) {
      const r = await das<{ items: DasAsset[] }>("searchAssets", {
        ownerAddress: owner,
        grouping: ["collection", COLLECTION_ADDRESS],
        burnt: false,
        page,
        limit: PAGE,
      });
      ids.push(...r.items.map((a) => a.id));
      if (r.items.length < PAGE) break;
    }
    return ids;
  }
  const assets = await fetchAssetsByOwner(getUmi(), owner, { skipDerivePlugins: true });
  return assets
    .filter((a) => a.updateAuthority.type === "Collection" && a.updateAuthority.address?.toString() === COLLECTION_ADDRESS)
    .map((a) => a.publicKey.toString());
}

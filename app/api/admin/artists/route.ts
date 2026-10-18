import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { collectionHandlers, type ReferenceDelegate } from "@/lib/reference-crud";
import { findSimilarArtists } from "@/lib/artist-fuzzy-match";

// GET (typeahead) and POST (create) never touch the products relation, so the
// generic factory applies unchanged even though Artist<->Product is a
// many-to-many (via ProductArtist) rather than the single-FK shape Label/
// Genre/ProductType use — countField picks the right relation so the
// typeahead's productCount reflects productArtists, not products. Rename
// (PATCH) and delete (DELETE) need bespoke handling — see ./[id]/route.ts.
const { GET, POST: createArtist } = collectionHandlers(
  db.artist as unknown as ReferenceDelegate,
  { countField: "productArtists" },
);
export { GET };

// STEP 5c: Artists only, warn-never-block fuzzy "did you mean". The exact
// normalized-name check (5b, inside createArtist) already ran and passed —
// this only ever surfaces a near-but-not-exact match, as a non-blocking hint
// alongside the artist that was just created.
export async function POST(req: Request) {
  const res = await createArtist(req);
  if (res.status !== 201) return res;
  const created = (await res.clone().json()) as { id: string; name: string };
  const candidates = await findSimilarArtists(created.name, created.id);
  if (candidates.length === 0) return res;
  return NextResponse.json({ ...created, candidates }, { status: 201 });
}

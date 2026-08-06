import { db } from "@/lib/db";
import { collectionHandlers, type ReferenceDelegate } from "@/lib/reference-crud";

// GET (typeahead) and POST (create) never touch the products relation, so the
// generic factory applies unchanged even though Artist<->Product is a
// many-to-many (via ProductArtist) rather than the single-FK shape Label/
// Genre/ProductType use — countField picks the right relation so the
// typeahead's productCount reflects productArtists, not products. Rename
// (PATCH) and delete (DELETE) need bespoke handling — see ./[id]/route.ts.
export const { GET, POST } = collectionHandlers(
  db.artist as unknown as ReferenceDelegate,
  { countField: "productArtists" },
);

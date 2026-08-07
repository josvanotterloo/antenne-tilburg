// Shared validation/normalization for product create + update. Pure and
// framework-free so it can be unit-tested and reused by POST and PATCH.

export interface ProductInput {
  artistIds: string[];
  title: string;
  catalogNumber: string | null;
  labelId: string;
  genreId: string;
  productTypeId: string;
  supplierId: string | null;
  condition: "NEW" | "SECONDHAND";
  price: string;
  description: string | null;
  coverImage: string | null;
}

export type ParseResult =
  | { ok: true; data: ProductInput }
  | { ok: false; error: string };

// Non-empty array of non-blank string ids, deduped preserving first-seen
// order (a client-side bug producing a repeated id isn't malicious input,
// just redundant — silently normalize rather than reject).
function parseArtistIds(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const ids: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (!trimmed) return null;
    if (!ids.includes(trimmed)) ids.push(trimmed);
  }
  return ids;
}

export function parseProductInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const artistIds = parseArtistIds(b.artistIds);
  if (!artistIds) {
    return { ok: false, error: "At least one artist is required" };
  }

  const title = str(b.title);
  if (!title) return { ok: false, error: "Title is required" };

  const labelId = str(b.labelId);
  if (!labelId) return { ok: false, error: "Label is required" };

  const genreId = str(b.genreId);
  if (!genreId) return { ok: false, error: "Genre is required" };

  const productTypeId = str(b.productTypeId);
  if (!productTypeId) return { ok: false, error: "Product type is required" };

  if (b.condition !== "NEW" && b.condition !== "SECONDHAND") {
    return { ok: false, error: "Condition is invalid" };
  }

  // Price accepts a finite non-negative number, or a decimal string (digits with
  // an optional single fractional part). Rejects loose Number() coercions —
  // Infinity/1e309 (would store as Decimal "Infinity" → Prisma 500), hex, and
  // exponent strings.
  let price: number;
  if (typeof b.price === "number") {
    price = b.price;
  } else if (typeof b.price === "string" && /^\d+(\.\d+)?$/.test(b.price.trim())) {
    price = Number(b.price.trim());
  } else {
    return { ok: false, error: "Price must be a non-negative number" };
  }
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Price must be a non-negative number" };
  }

  return {
    ok: true,
    data: {
      artistIds,
      title,
      catalogNumber: str(b.catalogNumber) || null,
      labelId,
      genreId,
      productTypeId,
      supplierId: str(b.supplierId) || null,
      condition: b.condition,
      price: String(price),
      description: str(b.description) || null,
      coverImage: str(b.coverImage) || null,
    },
  };
}

// Maps validated input to the Prisma create/update `data` shape (single
// relations by connect; artists as an ordered ProductArtist nested write).
// Shared by POST and PATCH so both stay in sync. `primaryArtistName` is
// resolved by the route handler (it needs a `db` lookup on artistIds[0],
// which by this point already exists — the admin form's Quick Add creates
// new artists immediately, before the product form ever submits) so this
// function stays pure. `mode` picks the create-vs-update nested-write shape:
// `deleteMany` is only valid inside an update (full-set replacement each
// save, matching how label/genre single-FK replacement already behaves) —
// Prisma's create-nested-write type doesn't have it at all.
export function toProductData(
  data: ProductInput,
  { primaryArtistName, mode }: { primaryArtistName: string; mode: "create" | "update" },
) {
  return {
    title: data.title,
    catalogNumber: data.catalogNumber,
    condition: data.condition,
    price: data.price,
    description: data.description,
    coverImage: data.coverImage,
    label: { connect: { id: data.labelId } },
    genre: { connect: { id: data.genreId } },
    productType: { connect: { id: data.productTypeId } },
    ...(data.supplierId
      ? { supplier: { connect: { id: data.supplierId } } }
      : mode === "update"
        ? { supplier: { disconnect: true } }
        : {}),
    primaryArtistName,
    productArtists: {
      ...(mode === "update" ? { deleteMany: {} } : {}),
      create: data.artistIds.map((artistId, position) => ({ artistId, position })),
    },
  };
}

// Shared validation/normalization for product create + update. Pure and
// framework-free so it can be unit-tested and reused by POST and PATCH.

export interface ProductInput {
  artist: string;
  title: string;
  catalogNumber: string | null;
  labelId: string;
  genreId: string;
  productTypeId: string;
  condition: "NEW" | "SECONDHAND";
  price: string;
  description: string | null;
  quantity: number;
}

export type ParseResult =
  | { ok: true; data: ProductInput }
  | { ok: false; error: string };

export function parseProductInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const artist = str(b.artist);
  if (!artist) return { ok: false, error: "Artist is required" };

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
  // exponent strings — mirroring the strict quantity rule below.
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

  // Quantity drives stock. Absent/blank → 0; a plain number, or a string of only
  // digits (no signs, decimals, hex, or exponents). Rejects loose coercions.
  const rawQty = typeof b.quantity === "string" ? b.quantity.trim() : b.quantity;
  let quantity: number;
  if (rawQty === undefined || rawQty === null || rawQty === "") {
    quantity = 0;
  } else if (typeof rawQty === "number") {
    quantity = rawQty;
  } else if (typeof rawQty === "string" && /^\d+$/.test(rawQty)) {
    quantity = Number(rawQty);
  } else {
    return { ok: false, error: "Quantity must be a non-negative whole number" };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, error: "Quantity must be a non-negative whole number" };
  }

  return {
    ok: true,
    data: {
      artist,
      title,
      catalogNumber: str(b.catalogNumber) || null,
      labelId,
      genreId,
      productTypeId,
      condition: b.condition,
      price: String(price),
      description: str(b.description) || null,
      quantity,
    },
  };
}

// Maps validated input to the Prisma create/update `data` shape (relations by
// connect). Shared by POST and PATCH so both stay in sync.
export function toProductData(data: ProductInput) {
  return {
    artist: data.artist,
    title: data.title,
    catalogNumber: data.catalogNumber,
    condition: data.condition,
    price: data.price,
    description: data.description,
    quantity: data.quantity,
    // inStock is derived — kept in sync so public queries (which filter on it) work.
    inStock: data.quantity > 0,
    label: { connect: { id: data.labelId } },
    genre: { connect: { id: data.genreId } },
    productType: { connect: { id: data.productTypeId } },
  };
}

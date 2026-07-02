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
  inStock: boolean;
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

  const rawPrice =
    typeof b.price === "number"
      ? b.price
      : typeof b.price === "string"
        ? b.price.trim()
        : "";
  const price = Number(rawPrice);
  if (rawPrice === "" || Number.isNaN(price) || price < 0) {
    return { ok: false, error: "Price must be a non-negative number" };
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
      inStock: typeof b.inStock === "boolean" ? b.inStock : true,
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
    inStock: data.inStock,
    label: { connect: { id: data.labelId } },
    genre: { connect: { id: data.genreId } },
    productType: { connect: { id: data.productTypeId } },
  };
}

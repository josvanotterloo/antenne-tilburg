import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseProductInput, toProductData } from "@/lib/product-input";
import { resolveArtists, resolveVariousArtists } from "@/lib/resolve-artists";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const products = await db.product.findMany({
    orderBy: [{ primaryArtistName: "asc" }, { title: "asc" }],
    include: {
      label: true,
      genre: true,
      productType: true,
      productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
    },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseProductInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Every selected artist must still exist, not just the primary one — a
  // missing non-primary id would otherwise hit an unhandled ProductArtist FK
  // violation instead of this graceful 400. The admin form's Quick Add
  // creates a new artist immediately (before the product form ever
  // submits), same as label/genre/productType, so this is a genuine
  // deleted-out-from-under-you race, not the common case.
  //
  // Various Artists products skip that lookup entirely — the shared VA
  // entity is resolved (created on first use) server-side instead of
  // trusting client-supplied artistIds.
  const artists = parsed.data.isVariousArtists
    ? [await resolveVariousArtists(db.artist)]
    : await resolveArtists(db.artist, parsed.data.artistIds);
  if (!artists) {
    return NextResponse.json(
      { error: "Selected artist no longer exists" },
      { status: 400 },
    );
  }

  try {
    const created = await db.product.create({
      data: toProductData(
        { ...parsed.data, artistIds: artists.map((a) => a.id) },
        { primaryArtistName: artists[0].name, mode: "create" },
      ),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // A labelId/genreId/productTypeId that doesn't exist (e.g. deleted by the
    // other admin) makes the nested connect throw P2025 — a client error, not a
    // 500 leaking Prisma internals.
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json(
        { error: "Selected label, genre, product type, or supplier no longer exists" },
        { status: 400 },
      );
    }
    throw error;
  }
}

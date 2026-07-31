import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseProductInput, toProductData } from "@/lib/product-input";
import { resolveArtists } from "@/lib/resolve-artists";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const product = await db.product.findUnique({
    where: { id },
    include: {
      label: true,
      genre: true,
      productType: true,
      productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseProductInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Every selected artist must still exist, not just the primary one (see
  // the matching comment in ../route.ts's POST).
  const artists = await resolveArtists(db.artist, parsed.data.artistIds);
  if (!artists) {
    return NextResponse.json(
      { error: "Selected artist no longer exists" },
      { status: 400 },
    );
  }

  try {
    const updated = await db.product.update({
      where: { id },
      data: toProductData(parsed.data, {
        primaryArtistName: artists[0].name,
        mode: "update",
      }),
    });
    return NextResponse.json(updated);
  } catch (error) {
    // Product deleted concurrently, or a connected relation no longer exists →
    // P2025. Return 404 like GET/DELETE rather than an unhandled 500.
    if ((error as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await db.product.delete({ where: { id } });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    // Prisma "record not found" (e.g. already deleted by another admin).
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Restricted by StockTransaction/SupplyOrderLine FKs once a product has
    // any stock history (a sale, adjustment, receive, or the opening-balance
    // backfill) — surfaced as a clean guard, not an unhandled 500.
    if (code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete a product with stock history" },
        { status: 409 },
      );
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}

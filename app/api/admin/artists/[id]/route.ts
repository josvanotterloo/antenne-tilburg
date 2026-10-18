import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { VARIOUS_ARTISTS_NAME } from "@/lib/resolve-artists";
import {
  normalizeReferenceName,
  findDuplicateByNormalizedName,
} from "@/lib/reference-dedupe";

// Bespoke rename/delete for Artist: unlike the generic reference-crud
// factory, rename must also refresh the denormalized primaryArtistName on
// any product where this artist is the position-0 (primary) artist, and the
// delete guard counts through the ProductArtist join instead of a single FK.

type RouteContext = { params: Promise<{ id: string }> };

function readName(body: unknown): string {
  const value = (body as { name?: unknown } | null)?.name;
  return typeof value === "string" ? value.trim() : "";
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const name = readName(await req.json().catch(() => null));
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  // Renaming the shared Various Artists entity (see
  // lib/resolve-artists.ts's resolveVariousArtists) would make future VA
  // product saves upsert a second, disconnected entity under the fixed
  // name, silently forking existing VA products from new ones.
  const existing = await db.artist.findUnique({
    where: { id },
    select: { name: true, normalizedName: true },
  });
  if (existing?.name === VARIOUS_ARTISTS_NAME) {
    return NextResponse.json(
      { error: "Cannot rename the shared Various Artists entity" },
      { status: 400 },
    );
  }
  const normalizedName = normalizeReferenceName(name);
  // A rename that doesn't actually change the normalized name must never be
  // blocked by another artist's legacy near-duplicate — see the matching
  // comment in lib/reference-crud.ts's itemHandlers.PATCH.
  const nameUnchanged = existing?.normalizedName === normalizedName;
  if (!nameUnchanged && (await findDuplicateByNormalizedName(db.artist, name, id))) {
    return NextResponse.json(
      { error: `"${name}" already exists` },
      { status: 409 },
    );
  }
  try {
    const [updated] = await db.$transaction([
      db.artist.update({
        where: { id },
        data: { name, normalizedName },
      }),
      db.product.updateMany({
        where: { productArtists: { some: { artistId: id, position: 0 } } },
        data: { primaryArtistName: name },
      }),
    ]);
    return NextResponse.json(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `"${name}" already exists` },
        { status: 409 },
      );
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const item = await db.artist.findUnique({
    where: { id },
    include: { _count: { select: { productArtists: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (item._count.productArtists > 0) {
    // Server-enforced delete guard — never trust the UI to hide the button.
    return NextResponse.json(
      {
        error: `In use by ${item._count.productArtists} products`,
        count: item._count.productArtists,
      },
      { status: 409 },
    );
  }
  await db.artist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

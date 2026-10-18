// Shared by the product POST/PATCH routes: validates that every requested
// artist id still exists (not just the primary one — a missing non-primary
// id used to hit an unhandled ProductArtist FK violation instead of a
// graceful 400) and resolves artistIds[0]'s name for primaryArtistName.
import { normalizeReferenceName } from "@/lib/reference-dedupe";

export interface ArtistDelegate {
  findMany(args: {
    where: { id: { in: string[] } };
  }): Promise<{ id: string; name: string }[]>;
}

export async function resolveArtists(
  delegate: ArtistDelegate,
  artistIds: string[],
): Promise<{ id: string; name: string }[] | null> {
  const found = await delegate.findMany({ where: { id: { in: artistIds } } });
  if (found.length !== artistIds.length) return null;
  const byId = new Map(found.map((a) => [a.id, a]));
  return artistIds.map((id) => byId.get(id)!);
}

// Shared single source of truth for the Various Artists / compilation
// Artist entity's name — used by the product routes (isVariousArtists
// products) and prisma/seed.ts.
export const VARIOUS_ARTISTS_NAME = "Various Artists";

export interface VariousArtistsDelegate {
  upsert(args: {
    where: { name: string };
    update: Record<string, never>;
    create: { name: string; normalizedName: string };
  }): Promise<{ id: string; name: string }>;
}

// Idempotent find-or-create for the shared "Various Artists" entity — an
// upsert avoids a race between two concurrent first-ever VA product saves.
// Sets normalizedName on create (lib/reference-dedupe.ts's app-level
// near-duplicate guard) so the shared entity is never invisible to it on a
// fresh database's first VA product save.
export function resolveVariousArtists(
  delegate: VariousArtistsDelegate,
): Promise<{ id: string; name: string }> {
  return delegate.upsert({
    where: { name: VARIOUS_ARTISTS_NAME },
    update: {},
    create: {
      name: VARIOUS_ARTISTS_NAME,
      normalizedName: normalizeReferenceName(VARIOUS_ARTISTS_NAME),
    },
  });
}

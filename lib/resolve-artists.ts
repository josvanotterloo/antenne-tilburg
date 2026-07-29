// Shared by the product POST/PATCH routes: validates that every requested
// artist id still exists (not just the primary one — a missing non-primary
// id used to hit an unhandled ProductArtist FK violation instead of a
// graceful 400) and resolves artistIds[0]'s name for primaryArtistName.

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

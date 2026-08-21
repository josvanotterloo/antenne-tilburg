// Shared by the product POST/PATCH routes: validates that every requested
// genre id still exists (mirrors lib/resolve-artists.ts's resolveArtists —
// same shape, same reasoning, for the ProductGenre many-to-many relation).

export interface GenreDelegate {
  findMany(args: {
    where: { id: { in: string[] } };
  }): Promise<{ id: string; name: string }[]>;
}

export async function resolveGenres(
  delegate: GenreDelegate,
  genreIds: string[],
): Promise<{ id: string; name: string }[] | null> {
  const found = await delegate.findMany({ where: { id: { in: genreIds } } });
  if (found.length !== genreIds.length) return null;
  const byId = new Map(found.map((g) => [g.id, g]));
  return genreIds.map((id) => byId.get(id)!);
}

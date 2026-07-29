// One-time backfill core for the Artist-entity migration: turn each
// Product's legacy plain-text `artist` column into a proper Artist row +
// ProductArtist link at position 0, deduplicating by name case-insensitively.
// Pure over an injected delegate so it is unit-testable; the runnable
// wrapper is scripts/backfill-artists.ts. Idempotent — findProductsNeedingBackfill
// only returns products with no existing ProductArtist link, so re-running
// after a partial run is safe.

export interface BackfillDelegate {
  findProductsNeedingBackfill(): Promise<{ id: string; artist: string }[]>;
  findOrCreateArtist(
    name: string,
  ): Promise<{ id: string; name: string; created: boolean }>;
  linkProductArtist(args: {
    productId: string;
    artistId: string;
    position: number;
  }): Promise<void>;
  setPrimaryArtistName(args: {
    productId: string;
    primaryArtistName: string;
  }): Promise<void>;
  countProductsWithoutArtist(): Promise<number>;
}

export interface BackfillResult {
  productsLinked: number;
  artistsCreated: number;
  remainingWithoutArtist: number;
}

export async function backfillArtists(
  delegate: BackfillDelegate,
): Promise<BackfillResult> {
  const products = await delegate.findProductsNeedingBackfill();
  let artistsCreated = 0;
  let productsLinked = 0;

  // Sequential, not parallel: case-insensitive dedup relies on each
  // findOrCreateArtist call seeing artists created earlier in this loop.
  for (const product of products) {
    const name = product.artist.trim();
    const artist = await delegate.findOrCreateArtist(name);
    if (artist.created) artistsCreated += 1;
    await delegate.linkProductArtist({
      productId: product.id,
      artistId: artist.id,
      position: 0,
    });
    await delegate.setPrimaryArtistName({
      productId: product.id,
      primaryArtistName: artist.name,
    });
    productsLinked += 1;
  }

  const remainingWithoutArtist = await delegate.countProductsWithoutArtist();
  return { productsLinked, artistsCreated, remainingWithoutArtist };
}

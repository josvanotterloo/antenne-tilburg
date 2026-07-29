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
  // Single call, not two: the real implementation wraps both writes in one
  // db.$transaction so they land together or not at all — no window where
  // primaryArtistName is set without a matching link, or vice versa.
  linkAndSetPrimaryArtist(args: {
    productId: string;
    artistId: string;
    artistName: string;
    position: number;
  }): Promise<void>;
  // Secondary (position >= 1) artist on a split legacy string — just a
  // link, no primaryArtistName write (already set for position 0).
  linkArtist(args: {
    productId: string;
    artistId: string;
    position: number;
  }): Promise<void>;
  countProductsWithoutArtist(): Promise<number>;
}

// Splits a legacy `artist` string on a literal " / " (space-slash-space)
// into one name per artist, for splits/comps/collaborations recorded as a
// single delimited string (e.g. "Jeff Mills / Surgeon"). Deliberately not a
// bare "/" split — that would corrupt real single-artist names that contain
// a slash without surrounding spaces (e.g. "AC/DC"). See "Known limitation"
// in docs/features/artist-entity-migration.md for what this still doesn't
// handle. Falls back to the original (possibly blank) string as a single
// name if splitting would otherwise produce nothing, preserving prior
// behavior for blank/whitespace-only legacy values rather than dropping a
// product's only artist entry.
function splitArtistNames(raw: string): string[] {
  const trimmed = raw.trim();
  const parts = trimmed
    .split(" / ")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [trimmed];
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
    const names = splitArtistNames(product.artist);
    const artists: { id: string; name: string }[] = [];
    for (const name of names) {
      const artist = await delegate.findOrCreateArtist(name);
      if (artist.created) artistsCreated += 1;
      artists.push(artist);
    }

    const [primary, ...rest] = artists;
    await delegate.linkAndSetPrimaryArtist({
      productId: product.id,
      artistId: primary.id,
      artistName: primary.name,
      position: 0,
    });
    for (const [i, artist] of rest.entries()) {
      await delegate.linkArtist({
        productId: product.id,
        artistId: artist.id,
        position: i + 1,
      });
    }
    productsLinked += 1;
  }

  const remainingWithoutArtist = await delegate.countProductsWithoutArtist();
  return { productsLinked, artistsCreated, remainingWithoutArtist };
}

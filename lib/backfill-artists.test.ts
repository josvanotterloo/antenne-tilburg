// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

import { backfillArtists, type BackfillDelegate } from "@/lib/backfill-artists";

type Row = { id: string; artist: string };

// "Done" means both the link exists AND primaryArtistName is set — never
// just one. A product is only ever complete when both are true together,
// since linkAndSetPrimaryArtist writes them atomically (see below).
function isDone(
  productId: string,
  links: { productId: string }[],
  primaryNames: Map<string, string>,
) {
  return links.some((l) => l.productId === productId) && primaryNames.has(productId);
}

function fakeDelegate(rows: Row[]) {
  const artists: { id: string; name: string }[] = [];
  const links: { productId: string; artistId: string; position: number }[] = [];
  const primaryNames = new Map<string, string>();
  let nextArtistId = 1;

  const delegate: BackfillDelegate = {
    findProductsNeedingBackfill: vi.fn(async () =>
      rows
        .filter((r) => !isDone(r.id, links, primaryNames))
        .map((r) => ({ ...r })),
    ),
    findOrCreateArtist: vi.fn(async (name: string) => {
      const existing = artists.find(
        (a) => a.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) return { ...existing, created: false };
      const created = { id: `a${nextArtistId++}`, name };
      artists.push(created);
      return { ...created, created: true };
    }),
    // Single delegate call so the real implementation can wrap both writes
    // in one db.$transaction — either both land, or neither does. A fake
    // that pushed to `links`/`primaryNames` in two separate statements
    // could never test that atomicity; vi.fn's default body below runs
    // as one unit, and a test can still simulate total failure via
    // mockRejectedValueOnce, which skips this body entirely.
    linkAndSetPrimaryArtist: vi.fn(
      async ({
        productId,
        artistId,
        artistName,
        position,
      }: {
        productId: string;
        artistId: string;
        artistName: string;
        position: number;
      }) => {
        links.push({ productId, artistId, position });
        primaryNames.set(productId, artistName);
      },
    ),
    // Secondary (non-primary) artists on a split legacy string: just a link,
    // no primaryArtistName write — that's already set by
    // linkAndSetPrimaryArtist for position 0.
    linkArtist: vi.fn(
      async ({
        productId,
        artistId,
        position,
      }: {
        productId: string;
        artistId: string;
        position: number;
      }) => {
        links.push({ productId, artistId, position });
      },
    ),
    countProductsWithoutArtist: vi.fn(async () =>
      rows.filter((r) => !isDone(r.id, links, primaryNames)).length,
    ),
  };

  return { delegate, artists, links, primaryNames };
}

describe("backfillArtists", () => {
  it("creates one Artist per distinct name and links each product at position 0", async () => {
    const { delegate, artists, links, primaryNames } = fakeDelegate([
      { id: "p1", artist: "Jeff Mills" },
      { id: "p2", artist: "Surgeon" },
    ]);

    const result = await backfillArtists(delegate);

    expect(result).toEqual({
      productsLinked: 2,
      artistsCreated: 2,
      remainingWithoutArtist: 0,
    });
    expect(artists).toEqual([
      { id: "a1", name: "Jeff Mills" },
      { id: "a2", name: "Surgeon" },
    ]);
    expect(links).toEqual([
      { productId: "p1", artistId: "a1", position: 0 },
      { productId: "p2", artistId: "a2", position: 0 },
    ]);
    expect(primaryNames.get("p1")).toBe("Jeff Mills");
    expect(primaryNames.get("p2")).toBe("Surgeon");
  });

  it("no product is left without a linked artist after backfill", async () => {
    const { delegate } = fakeDelegate([
      { id: "p1", artist: "A" },
      { id: "p2", artist: "B" },
      { id: "p3", artist: "C" },
    ]);

    const result = await backfillArtists(delegate);

    expect(result.remainingWithoutArtist).toBe(0);
  });

  it("deduplicates by name case-insensitively — variant-cased/whitespace duplicates link to the same Artist", async () => {
    const { delegate, artists, links, primaryNames } = fakeDelegate([
      { id: "p1", artist: "Vril" },
      { id: "p2", artist: "vril" },
    ]);

    const result = await backfillArtists(delegate);

    expect(result.artistsCreated).toBe(1);
    expect(artists).toEqual([{ id: "a1", name: "Vril" }]);
    expect(links[0].artistId).toBe(links[1].artistId);
    // First-encountered casing wins as the canonical stored name for both.
    expect(primaryNames.get("p1")).toBe("Vril");
    expect(primaryNames.get("p2")).toBe("Vril");
  });

  it("links and sets primaryArtistName in a single atomic call, not two separate writes", async () => {
    const { delegate } = fakeDelegate([{ id: "p1", artist: "Vril" }]);

    await backfillArtists(delegate);

    expect(delegate.linkAndSetPrimaryArtist).toHaveBeenCalledWith({
      productId: "p1",
      artistId: "a1",
      artistName: "Vril",
      position: 0,
    });
  });

  it("recovers if linkAndSetPrimaryArtist fails entirely — neither write lands, and the product is still seen as needing backfill", async () => {
    const { delegate, links, primaryNames } = fakeDelegate([
      { id: "p1", artist: "Vril" },
    ]);
    vi.mocked(delegate.linkAndSetPrimaryArtist).mockRejectedValueOnce(
      new Error("crashed"),
    );

    await expect(backfillArtists(delegate)).rejects.toThrow("crashed");
    // Neither half of the write landed — this is what makes the real
    // implementation's db.$transaction() meaningful: a mid-write crash
    // (or DB rollback) must never leave primaryArtistName set without a
    // matching link, or vice versa.
    expect(primaryNames.has("p1")).toBe(false);
    expect(links).toEqual([]);
    expect(await delegate.countProductsWithoutArtist()).toBe(1);

    // Re-run picks it up and finishes the job.
    const result = await backfillArtists(delegate);
    expect(result).toEqual({
      productsLinked: 1,
      artistsCreated: 0,
      remainingWithoutArtist: 0,
    });
  });

  it("completion check catches a product with a link but no primaryArtistName (e.g. a pre-existing bad state), not just a missing link", async () => {
    const { delegate, links, primaryNames } = fakeDelegate([
      { id: "p1", artist: "Vril" },
    ]);
    // Simulate a product that already has a ProductArtist link (from some
    // prior partial run) but never got primaryArtistName set — the old
    // completion check (link existence only) would wrongly call this done.
    links.push({ productId: "p1", artistId: "a1", position: 0 });
    primaryNames.delete("p1");

    expect(await delegate.countProductsWithoutArtist()).toBe(1);
  });

  it("splits a composite legacy artist string on ' / ' into separate linked Artist rows, in order", async () => {
    const { delegate, artists, links, primaryNames } = fakeDelegate([
      { id: "p1", artist: "Jeff Mills / Surgeon" },
    ]);

    const result = await backfillArtists(delegate);

    expect(result.artistsCreated).toBe(2);
    expect(artists).toEqual([
      { id: "a1", name: "Jeff Mills" },
      { id: "a2", name: "Surgeon" },
    ]);
    expect(links).toEqual([
      { productId: "p1", artistId: "a1", position: 0 },
      { productId: "p1", artistId: "a2", position: 1 },
    ]);
    // The first-listed artist is primary.
    expect(primaryNames.get("p1")).toBe("Jeff Mills");
  });

  it("splits three or more composite artists at increasing positions", async () => {
    const { delegate, links } = fakeDelegate([
      { id: "p1", artist: "A / B / C" },
    ]);

    await backfillArtists(delegate);

    expect(links.map((l) => l.position)).toEqual([0, 1, 2]);
  });

  it("does not split a name that merely contains a slash without surrounding spaces (e.g. \"AC/DC\")", async () => {
    const { delegate, artists, links } = fakeDelegate([
      { id: "p1", artist: "AC/DC" },
    ]);

    await backfillArtists(delegate);

    expect(artists).toEqual([{ id: "a1", name: "AC/DC" }]);
    expect(links).toEqual([{ productId: "p1", artistId: "a1", position: 0 }]);
  });

  it("is idempotent — running twice does not create duplicate Artists or links", async () => {
    const { delegate } = fakeDelegate([
      { id: "p1", artist: "Jeff Mills" },
      { id: "p2", artist: "Surgeon" },
    ]);

    const first = await backfillArtists(delegate);
    expect(first).toEqual({
      productsLinked: 2,
      artistsCreated: 2,
      remainingWithoutArtist: 0,
    });

    const second = await backfillArtists(delegate);
    expect(second).toEqual({
      productsLinked: 0,
      artistsCreated: 0,
      remainingWithoutArtist: 0,
    });
  });
});

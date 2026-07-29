// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

import { backfillArtists, type BackfillDelegate } from "@/lib/backfill-artists";

type Row = { id: string; artist: string };

function fakeDelegate(rows: Row[]) {
  const artists: { id: string; name: string }[] = [];
  const links: { productId: string; artistId: string; position: number }[] = [];
  const primaryNames = new Map<string, string>();
  let nextArtistId = 1;

  const delegate: BackfillDelegate = {
    findProductsNeedingBackfill: vi.fn(async () =>
      rows
        .filter((r) => !links.some((l) => l.productId === r.id))
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
    linkProductArtist: vi.fn(
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
    setPrimaryArtistName: vi.fn(
      async ({
        productId,
        primaryArtistName,
      }: {
        productId: string;
        primaryArtistName: string;
      }) => {
        primaryNames.set(productId, primaryArtistName);
      },
    ),
    countProductsWithoutArtist: vi.fn(async () =>
      rows.filter((r) => !links.some((l) => l.productId === r.id)).length,
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

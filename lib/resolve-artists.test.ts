// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

import {
  resolveArtists,
  resolveVariousArtists,
  VARIOUS_ARTISTS_NAME,
  type ArtistDelegate,
  type VariousArtistsDelegate,
} from "@/lib/resolve-artists";

function fakeDelegate(rows: { id: string; name: string }[]): ArtistDelegate {
  return {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      rows.filter((r) => where.id.in.includes(r.id)),
    ),
  };
}

describe("resolveArtists", () => {
  it("resolves all ids, preserving the requested order (not DB order)", async () => {
    const delegate = fakeDelegate([
      { id: "a2", name: "Surgeon" },
      { id: "a1", name: "Jeff Mills" },
    ]);

    const result = await resolveArtists(delegate, ["a1", "a2"]);

    expect(result).toEqual([
      { id: "a1", name: "Jeff Mills" },
      { id: "a2", name: "Surgeon" },
    ]);
  });

  it("returns null when the primary (first) artist no longer exists", async () => {
    const delegate = fakeDelegate([{ id: "a2", name: "Surgeon" }]);
    expect(await resolveArtists(delegate, ["a1", "a2"])).toBeNull();
  });

  it("returns null when a non-primary artist no longer exists", async () => {
    // The exact gap the review found: only artistIds[0] used to be checked.
    const delegate = fakeDelegate([{ id: "a1", name: "Jeff Mills" }]);
    expect(await resolveArtists(delegate, ["a1", "a2"])).toBeNull();
  });

  it("queries once for the full id set, not once per id", async () => {
    const delegate = fakeDelegate([
      { id: "a1", name: "Jeff Mills" },
      { id: "a2", name: "Surgeon" },
    ]);
    await resolveArtists(delegate, ["a1", "a2"]);
    expect(delegate.findMany).toHaveBeenCalledTimes(1);
    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2"] } },
    });
  });
});

describe("resolveVariousArtists", () => {
  function fakeUpsertDelegate(
    existing: { id: string; name: string } | null,
  ): VariousArtistsDelegate {
    return {
      upsert: vi.fn(async () => existing ?? { id: "va1", name: VARIOUS_ARTISTS_NAME }),
    };
  }

  it("upserts on the fixed 'Various Artists' name", async () => {
    const delegate = fakeUpsertDelegate(null);
    const result = await resolveVariousArtists(delegate);
    expect(delegate.upsert).toHaveBeenCalledWith({
      where: { name: VARIOUS_ARTISTS_NAME },
      update: {},
      create: { name: VARIOUS_ARTISTS_NAME },
    });
    expect(result).toEqual({ id: "va1", name: VARIOUS_ARTISTS_NAME });
  });

  it("returns the existing entity unchanged when it already exists", async () => {
    const delegate = fakeUpsertDelegate({ id: "existing-id", name: VARIOUS_ARTISTS_NAME });
    const result = await resolveVariousArtists(delegate);
    expect(result).toEqual({ id: "existing-id", name: VARIOUS_ARTISTS_NAME });
  });
});

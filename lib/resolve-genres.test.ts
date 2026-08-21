// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

import { resolveGenres, type GenreDelegate } from "@/lib/resolve-genres";

function fakeDelegate(rows: { id: string; name: string }[]): GenreDelegate {
  return {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      rows.filter((r) => where.id.in.includes(r.id)),
    ),
  };
}

describe("resolveGenres", () => {
  it("resolves all ids, preserving the requested order (not DB order)", async () => {
    const delegate = fakeDelegate([
      { id: "g2", name: "House" },
      { id: "g1", name: "Techno" },
    ]);

    const result = await resolveGenres(delegate, ["g1", "g2"]);

    expect(result).toEqual([
      { id: "g1", name: "Techno" },
      { id: "g2", name: "House" },
    ]);
  });

  it("returns null when the primary (first) genre no longer exists", async () => {
    const delegate = fakeDelegate([{ id: "g2", name: "House" }]);
    expect(await resolveGenres(delegate, ["g1", "g2"])).toBeNull();
  });

  it("returns null when a non-primary genre no longer exists", async () => {
    const delegate = fakeDelegate([{ id: "g1", name: "Techno" }]);
    expect(await resolveGenres(delegate, ["g1", "g2"])).toBeNull();
  });

  it("queries once for the full id set, not once per id", async () => {
    const delegate = fakeDelegate([
      { id: "g1", name: "Techno" },
      { id: "g2", name: "House" },
    ]);
    await resolveGenres(delegate, ["g1", "g2"]);
    expect(delegate.findMany).toHaveBeenCalledTimes(1);
    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["g1", "g2"] } },
    });
  });
});

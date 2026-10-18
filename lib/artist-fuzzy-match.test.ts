// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: vi.fn() },
}));

import { findSimilarArtists } from "@/lib/artist-fuzzy-match";
import { db } from "@/lib/db";

describe("findSimilarArtists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] for a blank name without touching the db", async () => {
    expect(await findSimilarArtists("  ", "new-id")).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns candidates with product counts for a real name", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([
      { id: "a1", name: "Jeff Mills", productCount: 28 },
    ] as never);

    const candidates = await findSimilarArtists("Jeff Milz", "new-id");

    expect(candidates).toEqual([
      { id: "a1", name: "Jeff Mills", productCount: 28 },
    ]);
  });

  it("queries by trigram similarity, excludes the given id, and caps at 5", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([] as never);

    await findSimilarArtists("Jeff Milz", "new-id");

    const arg = vi.mocked(db.$queryRaw).mock.calls[0][0] as unknown as {
      text: string;
      values: unknown[];
    };
    expect(arg.text).toMatch(/a\.name % \$/);
    expect(arg.text).toContain("a.id <>");
    expect(arg.text).toContain("LIMIT");
    expect(arg.text.toUpperCase()).toContain("ORDER BY SIMILARITY");
    expect(arg.values).toContain("Jeff Milz");
    expect(arg.values).toContain("new-id");
  });

  it("returns [] when nothing is similar", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([] as never);
    expect(await findSimilarArtists("Zzzyx", "new-id")).toEqual([]);
  });
});

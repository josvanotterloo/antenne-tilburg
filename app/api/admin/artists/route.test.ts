// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { artist: { findMany: vi.fn(), create: vi.fn() } },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/artists/route";

describe("GET /api/admin/artists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps the productArtists count to productCount, not products", async () => {
    vi.mocked(db.artist.findMany).mockResolvedValue([
      { id: "a1", name: "Vril", _count: { productArtists: 12 } },
    ] as never);

    const res = await GET(new Request("http://test/api"));

    expect(await res.json()).toEqual([{ id: "a1", name: "Vril", productCount: 12 }]);
    expect(db.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { _count: { select: { productArtists: true } } },
      }),
    );
  });

  it("caps results at 20 and orders alphabetically", async () => {
    vi.mocked(db.artist.findMany).mockResolvedValue([] as never);
    await GET(new Request("http://test/api"));
    expect(db.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" }, take: 20 }),
    );
  });
});

describe("POST /api/admin/artists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an artist from a valid name", async () => {
    vi.mocked(db.artist.create).mockResolvedValue({ id: "a1", name: "Vril" } as never);
    const res = await POST(
      new Request("http://test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Vril" }),
      }),
    );
    expect(res.status).toBe(201);
  });
});

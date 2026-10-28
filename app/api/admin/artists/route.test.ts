// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
  requireAdminUserId: vi.fn().mockResolvedValue({ userId: "u1" }),
}));
vi.mock("@/lib/db", () => ({
  db: { artist: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/artist-fuzzy-match", () => ({ findSimilarArtists: vi.fn() }));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/artists/route";
import { findSimilarArtists } from "@/lib/artist-fuzzy-match";
import { requireAdmin, requireAdminUserId } from "@/lib/api-auth";

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(null);
    vi.mocked(requireAdminUserId).mockResolvedValue({ userId: "u1" });
    vi.mocked(db.artist.findFirst).mockResolvedValue(null); // no normalized-name duplicate
    vi.mocked(findSimilarArtists).mockResolvedValue([]); // no fuzzy match by default
  });

  const postReq = (name: string) =>
    new Request("http://test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

  it("creates an artist from a valid name", async () => {
    vi.mocked(db.artist.create).mockResolvedValue({ id: "a1", name: "Vril" } as never);
    const res = await POST(postReq("Vril"));
    expect(res.status).toBe(201);
  });

  it("rejects a normalized-duplicate artist name with 409", async () => {
    vi.mocked(db.artist.findFirst).mockResolvedValue({ id: "existing" } as never);
    const res = await POST(postReq("VRIL"));
    expect(res.status).toBe(409);
    expect(db.artist.create).not.toHaveBeenCalled();
  });

  it("includes fuzzy candidates in the response, without blocking the create", async () => {
    vi.mocked(db.artist.create).mockResolvedValue({ id: "a2", name: "Jeff Milz" } as never);
    vi.mocked(findSimilarArtists).mockResolvedValue([
      { id: "a1", name: "Jeff Mills", productCount: 28 },
    ]);

    const res = await POST(postReq("Jeff Milz"));

    expect(res.status).toBe(201);
    expect(findSimilarArtists).toHaveBeenCalledWith("Jeff Milz", "a2");
    expect(await res.json()).toEqual({
      id: "a2",
      name: "Jeff Milz",
      candidates: [{ id: "a1", name: "Jeff Mills", productCount: 28 }],
    });
  });

  it("still returns 201 (without candidates) when the fuzzy lookup itself fails", async () => {
    vi.mocked(db.artist.create).mockResolvedValue({ id: "a1", name: "Vril" } as never);
    vi.mocked(findSimilarArtists).mockRejectedValue(new Error("pg_trgm unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(postReq("Vril"));

    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty("candidates");
  });

  it("omits candidates from the response when nothing is similar", async () => {
    vi.mocked(db.artist.create).mockResolvedValue({ id: "a1", name: "Vril" } as never);

    const res = await POST(postReq("Vril"));

    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty("candidates");
  });

  it("returns the 401 from requireAdminUserId without creating or checking for fuzzy matches", async () => {
    vi.mocked(requireAdminUserId).mockResolvedValue({
      denied: new Response(null, { status: 401 }) as never,
    });

    const res = await POST(postReq("Vril"));

    expect(res.status).toBe(401);
    expect(db.artist.create).not.toHaveBeenCalled();
    expect(findSimilarArtists).not.toHaveBeenCalled();
  });
});

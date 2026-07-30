// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { product: { findMany: vi.fn() } } }));

import { GET } from "@/app/api/admin/products/search/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const mockRequireAdmin = vi.mocked(requireAdmin);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/products/search", () => {
  it("maps title/primaryArtistName into a single display name", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([
      { id: "p1", title: "Torus", primaryArtistName: "Vril" },
    ] as never);
    const res = await GET(new Request("http://t/api/admin/products/search?q=torus"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "p1", name: "Vril — Torus" }]);
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, orderBy: { title: "asc" } }),
    );
  });

  it("returns the 401 from requireAdmin without querying", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await GET(new Request("http://t/api/admin/products/search"));
    expect(res.status).toBe(401);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });
});

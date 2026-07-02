// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { product: { findMany: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/admin/products/route";
import { DELETE } from "@/app/api/admin/products/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

// db type is PrismaClient; runtime is the mock above.
const product = db.product as unknown as { findMany: Mock; delete: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);

const ROW = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  condition: "NEW",
  price: "24.99",
  inStock: true,
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

describe("GET /api/admin/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(null);
  });

  it("returns products with label, genre and productType included", async () => {
    product.findMany.mockResolvedValue([ROW]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([ROW]);
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { label: true, genre: true, productType: true },
      }),
    );
  });

  it("returns the 401 from requireAdmin without querying", async () => {
    mockRequireAdmin.mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );

    const res = await GET();

    expect(res.status).toBe(401);
    expect(product.findMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(null);
  });

  it("deletes the product and returns ok", async () => {
    product.delete.mockResolvedValue(ROW);

    const res = await DELETE(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(200);
    expect(product.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});

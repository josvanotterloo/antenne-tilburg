// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { product: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { POST } from "@/app/api/admin/products/[id]/sell-one/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const product = db.product as unknown as { findUnique: Mock; update: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  product.update.mockResolvedValue({});
});

describe("POST /api/admin/products/[id]/sell-one", () => {
  it("decrements quantity and keeps inStock in sync", async () => {
    product.findUnique.mockResolvedValue({ quantity: 3 });
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(200);
    expect(product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { quantity: 2, inStock: true },
    });
  });

  it("sets inStock false when the last unit is sold", async () => {
    product.findUnique.mockResolvedValue({ quantity: 1 });
    await POST(req(), ctx("p1"));
    expect(product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { quantity: 0, inStock: false },
    });
  });

  it("is a no-op at 0 (stays 0, out of stock)", async () => {
    product.findUnique.mockResolvedValue({ quantity: 0 });
    await POST(req(), ctx("p1"));
    expect(product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { quantity: 0, inStock: false },
    });
  });

  it("404s an unknown product and does not update", async () => {
    product.findUnique.mockResolvedValue(null);
    const res = await POST(req(), ctx("nope"));
    expect(res.status).toBe(404);
    expect(product.update).not.toHaveBeenCalled();
  });

  it("returns the 401 from requireAdmin without touching the DB", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(401);
    expect(product.findUnique).not.toHaveBeenCalled();
  });
});

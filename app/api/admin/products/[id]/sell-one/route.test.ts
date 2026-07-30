// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));

import { POST } from "@/app/api/admin/products/[id]/sell-one/route";
import { applyStockTransaction } from "@/lib/stock";
import { requireAdmin } from "@/lib/api-auth";

const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("POST /api/admin/products/[id]/sell-one", () => {
  it("creates an OUT transaction of -1 and returns the updated product", async () => {
    mockApply.mockResolvedValue({ ok: true, quantity: 1, appliedQuantity: -1 });
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "p1", quantity: 1, inStock: true });
    expect(mockApply).toHaveBeenCalledWith(expect.anything(), {
      productId: "p1",
      type: "OUT",
      requestedQuantity: -1,
    });
  });

  it("404s an unknown product", async () => {
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });
    const res = await POST(req(), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("400s when already at zero, with the message from the engine", async () => {
    mockApply.mockResolvedValue({ ok: false, error: "Stock is already at zero" });
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Stock is already at zero" });
  });

  it("returns the 401 from requireAdmin without applying anything", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(401);
    expect(mockApply).not.toHaveBeenCalled();
  });
});

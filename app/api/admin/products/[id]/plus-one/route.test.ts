// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdminUserId: vi.fn().mockResolvedValue({ userId: "u1" }),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));

import { POST } from "@/app/api/admin/products/[id]/plus-one/route";
import { applyStockTransaction } from "@/lib/stock";
import { requireAdminUserId } from "@/lib/api-auth";

const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdminUserId = vi.mocked(requireAdminUserId);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminUserId.mockResolvedValue({ userId: "u1" });
});

describe("POST /api/admin/products/[id]/plus-one", () => {
  it("creates an IN transaction of +1 and returns the updated product", async () => {
    mockApply.mockResolvedValue({ ok: true, quantity: 3, appliedQuantity: 1 });
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "p1", quantity: 3, inStock: true });
    expect(mockApply).toHaveBeenCalledWith(expect.anything(), {
      productId: "p1",
      type: "IN",
      requestedQuantity: 1,
      actorUserId: "u1",
    });
  });

  it("404s an unknown product", async () => {
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });
    const res = await POST(req(), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns the 401 from requireAdminUserId without applying anything", async () => {
    mockRequireAdminUserId.mockResolvedValue({
      denied: new Response(null, { status: 401 }) as never,
    });
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(401);
    expect(mockApply).not.toHaveBeenCalled();
  });
});

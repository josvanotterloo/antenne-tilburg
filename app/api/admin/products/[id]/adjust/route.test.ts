// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdminUserId: vi.fn().mockResolvedValue({ userId: "u1" }) }));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));

import { POST } from "@/app/api/admin/products/[id]/adjust/route";
import { applyStockTransaction } from "@/lib/stock";
import { requireAdminUserId } from "@/lib/api-auth";

const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdminUserId = vi.mocked(requireAdminUserId);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminUserId.mockResolvedValue({ userId: "u1" });
});

describe("POST /api/admin/products/[id]/adjust", () => {
  it("applies a positive adjustment", async () => {
    mockApply.mockResolvedValue({ ok: true, quantity: 8, appliedQuantity: 3 });
    const res = await POST(req({ delta: 3, note: "recount" }), ctx("p1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ quantity: 8, appliedQuantity: 3, clamped: false });
    expect(mockApply).toHaveBeenCalledWith(expect.anything(), {
      productId: "p1",
      type: "ADJUSTMENT",
      requestedQuantity: 3,
      note: "recount",
      actorUserId: "u1",
    });
  });

  it("reports clamped:true when the applied amount was floored", async () => {
    mockApply.mockResolvedValue({ ok: true, quantity: 0, appliedQuantity: -2 });
    const res = await POST(req({ delta: -5, note: "damaged" }), ctx("p1"));
    expect(await res.json()).toMatchObject({ appliedQuantity: -2, clamped: true });
  });

  it("400s invalid input without calling the engine", async () => {
    const res = await POST(req({ delta: 0, note: "x" }), ctx("p1"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("404s an unknown product", async () => {
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });
    const res = await POST(req({ delta: 1, note: "x" }), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns the 401 from requireAdminUserId without parsing or applying", async () => {
    mockRequireAdminUserId.mockResolvedValue({
      denied: new Response(null, { status: 401 }) as never,
    });
    const res = await POST(req({ delta: 1, note: "x" }), ctx("p1"));
    expect(res.status).toBe(401);
    expect(mockApply).not.toHaveBeenCalled();
  });
});

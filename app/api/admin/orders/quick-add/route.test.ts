// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supply-order-quick-add", () => ({ quickAddToOrder: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn() } }));

import { db } from "@/lib/db";
import { quickAddToOrder } from "@/lib/supply-order-quick-add";
import { POST } from "@/app/api/admin/orders/quick-add/route";
import { requireAdmin } from "@/lib/api-auth";

const mockTransaction = db.$transaction as unknown as Mock;
const mockQuickAdd = quickAddToOrder as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
});

describe("POST /api/admin/orders/quick-add", () => {
  it("400s a missing productId without starting a transaction", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns the line with the result's status on success", async () => {
    mockQuickAdd.mockResolvedValue({ ok: true, status: 201, line: { id: "l1" } });
    const res = await POST(req({ productId: "p1" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "l1" });
  });

  it("surfaces a failure's status and error", async () => {
    mockQuickAdd.mockResolvedValue({ ok: false, status: 409, error: "Product already in open order" });
    const res = await POST(req({ productId: "p1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Product already in open order" });
  });
});

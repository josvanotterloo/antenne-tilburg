// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { supplyOrder: { findMany: vi.fn(), create: vi.fn() } } }));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/orders/route";
import { requireAdmin } from "@/lib/api-auth";

const order = db.supplyOrder as unknown as { findMany: Mock; create: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (body: unknown) =>
  new Request("http://t/api/admin/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const VALID = {
  supplierId: "s1",
  reference: "PO-1",
  notes: null,
  orderedAt: "2026-07-29T10:00",
  lines: [{ productId: "p1", quantityOrdered: 5 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/orders", () => {
  it("returns orders newest orderedAt first", async () => {
    order.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { orderedAt: "desc" } }),
    );
  });
});

describe("POST /api/admin/orders", () => {
  it("creates an order with nested lines (201)", async () => {
    order.create.mockResolvedValue({ id: "o1" });
    const res = await POST(req(VALID));
    expect(res.status).toBe(201);
    expect(order.create.mock.calls[0][0].data).toMatchObject({
      supplierId: "s1",
      reference: "PO-1",
      lines: { create: [{ productId: "p1", quantityOrdered: 5 }] },
    });
  });

  it("400s invalid input without writing", async () => {
    const res = await POST(req({ ...VALID, lines: [] }));
    expect(res.status).toBe(400);
    expect(order.create).not.toHaveBeenCalled();
  });

  it("400s when the supplier or a product no longer exists (P2025)", async () => {
    order.create.mockRejectedValue({ code: "P2025" });
    const res = await POST(req(VALID));
    expect(res.status).toBe(400);
  });
});

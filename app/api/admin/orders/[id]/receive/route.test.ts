// app/api/admin/orders/[id]/receive/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    supplyOrder: { findUnique: vi.fn(), update: vi.fn() },
    supplyOrderLine: { update: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { POST } from "@/app/api/admin/orders/[id]/receive/route";
import { requireAdmin } from "@/lib/api-auth";

const supplyOrder = db.supplyOrder as unknown as { findUnique: Mock; update: Mock };
const supplyOrderLine = db.supplyOrderLine as unknown as { update: Mock; findMany: Mock };
const mockTransaction = db.$transaction as unknown as Mock;
const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const LINE = { id: "l1", productId: "p1", quantityOrdered: 5, quantityReceived: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  // Pass `db` itself as `tx` — a real Prisma transaction client exposes the
  // same model delegates as the top-level client. `fn({})` (an empty stub)
  // would make `tx.supplyOrderLine.update`/`tx.supplyOrder.update` throw,
  // which masks the route's actual atomicity guarantee rather than testing it.
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
});

describe("POST /api/admin/orders/[id]/receive", () => {
  it("applies an IN transaction per received line and sets status PARTIAL when under-received", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    mockApply.mockResolvedValue({ ok: true, quantity: 3, appliedQuantity: 3 });
    supplyOrderLine.update.mockResolvedValue({});
    supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 3 }]);
    supplyOrder.update.mockResolvedValue({ id: "o1", status: "PARTIAL" });

    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] }), ctx("o1"));

    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith(expect.anything(), {
      productId: "p1",
      type: "IN",
      requestedQuantity: 3,
      note: "Received from supply order",
      supplyOrderLineId: "l1",
    });
    expect(supplyOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PARTIAL" }) }),
    );
  });

  it("sets status RECEIVED once every line is fully received", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL", lines: [LINE] });
    mockApply.mockResolvedValue({ ok: true, quantity: 5, appliedQuantity: 5 });
    supplyOrderLine.update.mockResolvedValue({});
    supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 5 }]);
    supplyOrder.update.mockResolvedValue({ id: "o1", status: "RECEIVED" });

    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 5 }] }), ctx("o1"));

    expect(res.status).toBe(200);
    expect(supplyOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RECEIVED" }) }),
    );
  });

  it("400s receiving more than was ordered", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 6 }] }), ctx("o1"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("400s when nothing in the payload has receiveNow > 0", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 0 }] }), ctx("o1"));
    expect(res.status).toBe(400);
  });

  it("409s an already-RECEIVED order", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "RECEIVED", lines: [LINE] });
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 1 }] }), ctx("o1"));
    expect(res.status).toBe(409);
  });

  it("404s an unknown order", async () => {
    supplyOrder.findUnique.mockResolvedValue(null);
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 1 }] }), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

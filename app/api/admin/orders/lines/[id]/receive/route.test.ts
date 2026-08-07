// app/api/admin/orders/lines/[id]/receive/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { supplyOrderLine: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));

import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { PATCH } from "@/app/api/admin/orders/lines/[id]/receive/route";
import { requireAdmin } from "@/lib/api-auth";

const line = db.supplyOrderLine as unknown as { findUnique: Mock };
const mockTransaction = db.$transaction as unknown as Mock;
const mockApply = applyStockTransaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// Distinct from `db` on purpose — see the comment in the (now-removed)
// whole-order receive route's test this was modeled on: reusing `db` as
// `tx` would hide a regression to a non-transactional write.
const tx = {
  supplyOrderLine: { update: vi.fn(), findMany: vi.fn() },
  supplyOrder: { update: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));
});

const LINE = {
  id: "l1",
  productId: "p1",
  quantityOrdered: 5,
  quantityReceived: 0,
  supplyOrderId: "o1",
};

describe("PATCH /api/admin/orders/lines/[id]/receive", () => {
  it("applies an IN transaction, increments the line, and sets order status PARTIAL when under-received", async () => {
    line.findUnique.mockResolvedValue(LINE);
    mockApply.mockResolvedValue({ ok: true, quantity: 3, appliedQuantity: 3 });
    tx.supplyOrderLine.update.mockResolvedValue({});
    tx.supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 3 }]);
    tx.supplyOrder.update.mockResolvedValue({ id: "o1", status: "PARTIAL" });

    const res = await PATCH(req({ quantityReceived: 3 }), ctx("l1"));

    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith(tx, {
      productId: "p1",
      type: "IN",
      requestedQuantity: 3,
      note: "Received from supply order",
      supplyOrderLineId: "l1",
    });
    expect(tx.supplyOrderLine.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { quantityReceived: { increment: 3 } },
    });
    expect(tx.supplyOrder.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "PARTIAL", receivedAt: expect.any(Date) },
    });
  });

  it("sets order status RECEIVED once every line on the order is fully received", async () => {
    line.findUnique.mockResolvedValue(LINE);
    mockApply.mockResolvedValue({ ok: true, quantity: 5, appliedQuantity: 5 });
    tx.supplyOrderLine.update.mockResolvedValue({});
    tx.supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 5 }]);
    tx.supplyOrder.update.mockResolvedValue({ id: "o1", status: "RECEIVED" });

    const res = await PATCH(req({ quantityReceived: 5 }), ctx("l1"));

    expect(res.status).toBe(200);
    expect(tx.supplyOrder.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "RECEIVED", receivedAt: expect.any(Date) },
    });
  });

  it("400s receiving more than the remaining quantity, without applying anything", async () => {
    line.findUnique.mockResolvedValue({ ...LINE, quantityReceived: 3 });
    const res = await PATCH(req({ quantityReceived: 3 }), ctx("l1")); // 3 + 3 > 5 ordered
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("400s a zero or negative quantityReceived", async () => {
    line.findUnique.mockResolvedValue(LINE);
    const res = await PATCH(req({ quantityReceived: 0 }), ctx("l1"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("404s an unknown line", async () => {
    line.findUnique.mockResolvedValue(null);
    const res = await PATCH(req({ quantityReceived: 1 }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns a clean 400, not a 500, when applyStockTransaction fails inside the transaction", async () => {
    line.findUnique.mockResolvedValue(LINE);
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });
    const res = await PATCH(req({ quantityReceived: 3 }), ctx("l1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Product not found");
  });
});

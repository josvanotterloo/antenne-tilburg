// app/api/admin/orders/[id]/receive/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    supplyOrder: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { POST } from "@/app/api/admin/orders/[id]/receive/route";
import { requireAdmin } from "@/lib/api-auth";

const supplyOrder = db.supplyOrder as unknown as { findUnique: Mock };
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

// A distinct double, separate from `db` — if the route ever swaps a
// `tx.supplyOrderLine.update` call for `db.supplyOrderLine.update` (breaking
// the transaction's atomicity), these assertions must fail. Reusing `db`
// itself as `tx` would make that regression invisible, since both would
// resolve to the same mock.
const tx = {
  supplyOrderLine: { update: vi.fn(), findMany: vi.fn() },
  supplyOrder: { update: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));
});

describe("POST /api/admin/orders/[id]/receive", () => {
  it("applies an IN transaction per received line and sets status PARTIAL when under-received", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    mockApply.mockResolvedValue({ ok: true, quantity: 3, appliedQuantity: 3 });
    tx.supplyOrderLine.update.mockResolvedValue({});
    tx.supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 3 }]);
    tx.supplyOrder.update.mockResolvedValue({ id: "o1", status: "PARTIAL" });

    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] }), ctx("o1"));

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
    expect(tx.supplyOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PARTIAL", receivedAt: expect.any(Date) }),
      }),
    );
  });

  it("sets status RECEIVED once every line is fully received", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL", lines: [LINE] });
    mockApply.mockResolvedValue({ ok: true, quantity: 5, appliedQuantity: 5 });
    tx.supplyOrderLine.update.mockResolvedValue({});
    tx.supplyOrderLine.findMany.mockResolvedValue([{ ...LINE, quantityReceived: 5 }]);
    tx.supplyOrder.update.mockResolvedValue({ id: "o1", status: "RECEIVED" });

    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 5 }] }), ctx("o1"));

    expect(res.status).toBe(200);
    expect(tx.supplyOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RECEIVED", receivedAt: expect.any(Date) }),
      }),
    );
  });

  it("re-receives a PARTIAL line for the remainder: over-shoot 400s, exact remainder 200s with RECEIVED", async () => {
    const partialLine = { ...LINE, quantityReceived: 3, quantityOrdered: 5 };

    // (a) Trying to receive 3 more on top of the 3 already received would
    // exceed the 5 ordered — must 400 before applying anything.
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL", lines: [partialLine] });
    const overshoot = await POST(
      req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] }),
      ctx("o1"),
    );
    expect(overshoot.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();

    // (b) Receiving exactly the remainder (2) succeeds and completes the line.
    vi.clearAllMocks();
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL", lines: [partialLine] });
    mockApply.mockResolvedValue({ ok: true, quantity: 5, appliedQuantity: 2 });
    tx.supplyOrderLine.update.mockResolvedValue({});
    tx.supplyOrderLine.findMany.mockResolvedValue([{ ...partialLine, quantityReceived: 5 }]);
    tx.supplyOrder.update.mockResolvedValue({ id: "o1", status: "RECEIVED" });

    const remainder = await POST(
      req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 2 }] }),
      ctx("o1"),
    );
    expect(remainder.status).toBe(200);
    expect(tx.supplyOrderLine.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { quantityReceived: { increment: 2 } },
    });
    expect(tx.supplyOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RECEIVED" }) }),
    );
  });

  it("400s receiving more than was ordered", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 6 }] }), ctx("o1"));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("400s the whole batch, calling applyStockTransaction for neither line, when one of several lines would over-receive", async () => {
    const line2 = { id: "l2", productId: "p2", quantityOrdered: 2, quantityReceived: 0 };
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE, line2] });

    const res = await POST(
      req({
        lines: [
          { supplyOrderLineId: "l1", receiveNow: 2 }, // valid on its own
          { supplyOrderLineId: "l2", receiveNow: 3 }, // exceeds quantityOrdered: 2
        ],
      }),
      ctx("o1"),
    );

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

  it("returns a clean 400, not a 500, when applyStockTransaction fails inside the transaction", async () => {
    supplyOrder.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", lines: [LINE] });
    mockApply.mockResolvedValue({ ok: false, error: "Product not found" });

    const res = await POST(req({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] }), ctx("o1"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Product not found");
  });
});

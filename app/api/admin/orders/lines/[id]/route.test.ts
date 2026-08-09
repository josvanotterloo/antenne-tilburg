// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: {
    supplyOrderLine: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { PATCH, DELETE } from "@/app/api/admin/orders/lines/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const line = db.supplyOrderLine as unknown as { findUnique: Mock; update: Mock; delete: Mock };
const mockTransaction = db.$transaction as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = () => new Request("http://t/x", { method: "DELETE" });

// Distinct from `db` on purpose, same rationale as receive/route.test.ts:
// DELETE's guard-read and delete both run against this tx double. If a
// regression moved the implementation back to reading/deleting via plain
// `db`, these mocks would go unused and the calls would hit the real
// (unmocked) tx methods, failing the test.
const tx = {
  supplyOrderLine: { findUnique: vi.fn(), delete: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));
});

describe("PATCH /api/admin/orders/lines/[id]", () => {
  it("updates quantityOrdered on a line whose order is still open", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 2,
      supplyOrder: { status: "PENDING" },
    });
    line.update.mockResolvedValue({ id: "l1", quantityOrdered: 6 });
    const res = await PATCH(req({ quantityOrdered: 6 }), ctx("l1"));
    expect(res.status).toBe(200);
    expect(line.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { quantityOrdered: 6 },
    });
  });

  it("400s a quantity below what's already been received, without writing", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 5,
      supplyOrder: { status: "PARTIAL" },
    });
    const res = await PATCH(req({ quantityOrdered: 3 }), ctx("l1"));
    expect(res.status).toBe(400);
    expect(line.update).not.toHaveBeenCalled();
  });

  it("404s an unknown line", async () => {
    line.findUnique.mockResolvedValue(null);
    const res = await PATCH(req({ quantityOrdered: 3 }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("409s a line on a RECEIVED order, without writing", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 5,
      supplyOrder: { status: "RECEIVED" },
    });
    const res = await PATCH(req({ quantityOrdered: 5 }), ctx("l1"));
    expect(res.status).toBe(409);
    expect(line.update).not.toHaveBeenCalled();
  });

  it("accepts quantity equal to quantityReceived (floor boundary) on open orders", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 5,
      supplyOrder: { status: "PARTIAL" },
    });
    line.update.mockResolvedValue({ id: "l1", quantityOrdered: 5 });
    const res = await PATCH(req({ quantityOrdered: 5 }), ctx("l1"));
    expect(res.status).toBe(200);
    expect(line.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { quantityOrdered: 5 },
    });
  });

  it("400s invalid body without querying the database", async () => {
    const res = await PATCH(req({ quantityOrdered: -1 }), ctx("l1"));
    expect(res.status).toBe(400);
    expect(line.findUnique).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/orders/lines/[id]", () => {
  it("deletes a line on a still-PENDING order with no receipts", async () => {
    tx.supplyOrderLine.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 0,
      supplyOrder: { status: "PENDING" },
    });
    const res = await DELETE(deleteReq(), ctx("l1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(tx.supplyOrderLine.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
  });

  it("404s an unknown line, without deleting", async () => {
    tx.supplyOrderLine.findUnique.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), ctx("missing"));
    expect(res.status).toBe(404);
    expect(tx.supplyOrderLine.delete).not.toHaveBeenCalled();
  });

  it("409s a line whose parent order is not PENDING, without deleting", async () => {
    tx.supplyOrderLine.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 0,
      supplyOrder: { status: "PARTIAL" },
    });
    const res = await DELETE(deleteReq(), ctx("l1"));
    expect(res.status).toBe(409);
    expect(tx.supplyOrderLine.delete).not.toHaveBeenCalled();
  });

  // Structurally this branch should be unreachable via normal application
  // flow (a PENDING order can't have a line with quantityReceived > 0 — any
  // receipt flips the order's status away from PENDING). The fixture below
  // is deliberately unrealistic: it forces status back to PENDING while
  // leaving quantityReceived > 0, to prove the defense-in-depth guard fires
  // independently of the status check above it.
  it("409s a line that already has receipts, even if the order status reads PENDING", async () => {
    tx.supplyOrderLine.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 3,
      supplyOrder: { status: "PENDING" },
    });
    const res = await DELETE(deleteReq(), ctx("l1"));
    expect(res.status).toBe(409);
    expect(tx.supplyOrderLine.delete).not.toHaveBeenCalled();
  });

  // Regression guard for the race described in the finding: DELETE must run
  // its guard-read and its delete inside the SAME db.$transaction call,
  // against the tx client, not the top-level db client. If the
  // implementation regressed to reading/deleting via `db` directly (outside
  // a transaction), this test's `tx` mocks would never be consulted —
  // `tx.supplyOrderLine.findUnique` would return undefined by default,
  // and the delete would 404 instead of succeeding, or the `db`-level
  // methods asserted below would never be called.
  it("runs the guard read and the delete inside a single db.$transaction call, not against the top-level db client", async () => {
    tx.supplyOrderLine.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 0,
      supplyOrder: { status: "PENDING" },
    });
    const res = await DELETE(deleteReq(), ctx("l1"));

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(tx.supplyOrderLine.findUnique).toHaveBeenCalledWith({
      where: { id: "l1" },
      include: { supplyOrder: true },
    });
    expect(tx.supplyOrderLine.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
    // The top-level db client's own findUnique/delete must not be touched —
    // both must go through the transaction client instead.
    expect(line.findUnique).not.toHaveBeenCalled();
    expect(line.delete).not.toHaveBeenCalled();
  });
});

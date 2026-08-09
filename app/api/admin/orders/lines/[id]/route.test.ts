// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { supplyOrderLine: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { PATCH, DELETE } from "@/app/api/admin/orders/lines/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const line = db.supplyOrderLine as unknown as { findUnique: Mock; update: Mock; delete: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = () => new Request("http://t/x", { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
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
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 0,
      supplyOrder: { status: "PENDING" },
    });
    const res = await DELETE(deleteReq(), ctx("l1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(line.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
  });

  it("404s an unknown line, without deleting", async () => {
    line.findUnique.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), ctx("missing"));
    expect(res.status).toBe(404);
    expect(line.delete).not.toHaveBeenCalled();
  });

  it("409s a line whose parent order is not PENDING, without deleting", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 0,
      supplyOrder: { status: "PARTIAL" },
    });
    const res = await DELETE(deleteReq(), ctx("l1"));
    expect(res.status).toBe(409);
    expect(line.delete).not.toHaveBeenCalled();
  });

  // Structurally this branch should be unreachable via normal application
  // flow (a PENDING order can't have a line with quantityReceived > 0 — any
  // receipt flips the order's status away from PENDING). The fixture below
  // is deliberately unrealistic: it forces status back to PENDING while
  // leaving quantityReceived > 0, to prove the defense-in-depth guard fires
  // independently of the status check above it.
  it("409s a line that already has receipts, even if the order status reads PENDING", async () => {
    line.findUnique.mockResolvedValue({
      id: "l1",
      quantityReceived: 3,
      supplyOrder: { status: "PENDING" },
    });
    const res = await DELETE(deleteReq(), ctx("l1"));
    expect(res.status).toBe(409);
    expect(line.delete).not.toHaveBeenCalled();
  });
});

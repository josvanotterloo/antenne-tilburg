// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { supplyOrder: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { GET, PATCH, DELETE } from "@/app/api/admin/orders/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const order = db.supplyOrder as unknown as { findUnique: Mock; update: Mock; delete: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patchReq = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const getReq = () => new Request("http://t/x");
const delReq = () => new Request("http://t/x", { method: "DELETE" });

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

describe("GET /api/admin/orders/[id]", () => {
  it("404s an unknown order", async () => {
    order.findUnique.mockResolvedValue(null);
    const res = await GET(getReq(), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/orders/[id]", () => {
  it("replaces the line set on a PENDING order", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING" });
    order.update.mockResolvedValue({ id: "o1" });
    const res = await PATCH(patchReq(VALID), ctx("o1"));
    expect(res.status).toBe(200);
    expect(order.update.mock.calls[0][0].data.lines).toEqual({
      deleteMany: {},
      create: [{ productId: "p1", quantityOrdered: 5 }],
    });
  });

  it("409s a non-PENDING order without writing", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL" });
    const res = await PATCH(patchReq(VALID), ctx("o1"));
    expect(res.status).toBe(409);
    expect(order.update).not.toHaveBeenCalled();
  });

  it("404s an unknown order", async () => {
    order.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchReq(VALID), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/orders/[id]", () => {
  it("deletes a PENDING order", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING" });
    order.delete.mockResolvedValue({ id: "o1" });
    const res = await DELETE(delReq(), ctx("o1"));
    expect(res.status).toBe(200);
  });

  it("409s a non-PENDING order without deleting", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "RECEIVED" });
    const res = await DELETE(delReq(), ctx("o1"));
    expect(res.status).toBe(409);
    expect(order.delete).not.toHaveBeenCalled();
  });
});

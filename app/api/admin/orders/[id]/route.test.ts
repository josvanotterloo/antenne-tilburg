// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { supplyOrder: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { PATCH, DELETE } from "@/app/api/admin/orders/[id]/route";
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
const delReq = () => new Request("http://t/x", { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("PATCH /api/admin/orders/[id]", () => {
  it("sets sentAt on a PENDING order with no sentAt yet", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING", sentAt: null });
    order.update.mockResolvedValue({ id: "o1", status: "PENDING", sentAt: new Date("2026-08-06T12:00:00.000Z") });
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("o1"));
    expect(res.status).toBe(200);
    expect(order.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { sentAt: expect.any(Date) },
    });
  });

  it("sets sentAt on a PARTIAL order with no sentAt yet", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL", sentAt: null });
    order.update.mockResolvedValue({ id: "o1", status: "PARTIAL", sentAt: new Date("2026-08-06T12:00:00.000Z") });
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("o1"));
    expect(res.status).toBe(200);
    expect(order.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { sentAt: expect.any(Date) },
    });
  });

  it("is a no-op success on an order that already has sentAt set — does not write, does not bump the timestamp", async () => {
    const firstSentAt = new Date("2026-08-01T09:00:00.000Z");
    order.findUnique.mockResolvedValue({ id: "o1", status: "PARTIAL", sentAt: firstSentAt });
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("o1"));
    expect(res.status).toBe(200);
    expect(order.update).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.sentAt).toBe(firstSentAt.toISOString());
  });

  it("409s a RECEIVED order without writing", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "RECEIVED", sentAt: new Date() });
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("o1"));
    expect(res.status).toBe(409);
    expect(order.update).not.toHaveBeenCalled();
  });

  it("400s any body other than { status: 'SENT' }", async () => {
    const res = await PATCH(patchReq({ status: "RECEIVED" }), ctx("o1"));
    expect(res.status).toBe(400);
    expect(order.findUnique).not.toHaveBeenCalled();
  });

  it("404s an unknown order", async () => {
    order.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchReq({ status: "SENT" }), ctx("missing"));
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

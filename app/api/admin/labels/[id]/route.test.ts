// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { label: { update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { PATCH, DELETE } from "@/app/api/admin/labels/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const label = db.label as unknown as { update: Mock; findUnique: Mock; delete: Mock };
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

describe("PATCH /api/admin/labels/[id]", () => {
  it("updates name and supplierId, returns the shaped item", async () => {
    label.update.mockResolvedValue({
      id: "l1",
      name: "Warp Records",
      supplier: { id: "s1", name: "Beta" },
    });
    const res = await PATCH(patchReq({ name: "Warp Records", supplierId: "s1" }), ctx("l1"));
    expect(res.status).toBe(200);
    expect(label.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { name: "Warp Records", supplierId: "s1" },
      include: { supplier: true },
    });
    expect(await res.json()).toEqual({
      id: "l1",
      name: "Warp Records",
      supplierId: "s1",
      supplierName: "Beta",
    });
  });

  it("404s an unknown label", async () => {
    label.update.mockRejectedValue({ code: "P2025" });
    const res = await PATCH(patchReq({ name: "X" }), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/labels/[id]", () => {
  it("409s a label still used by products", async () => {
    label.findUnique.mockResolvedValue({ id: "l1", _count: { products: 2 } });
    const res = await DELETE(delReq(), ctx("l1"));
    expect(res.status).toBe(409);
    expect(label.delete).not.toHaveBeenCalled();
  });

  it("deletes an unused label", async () => {
    label.findUnique.mockResolvedValue({ id: "l1", _count: { products: 0 } });
    label.delete.mockResolvedValue({ id: "l1" });
    const res = await DELETE(delReq(), ctx("l1"));
    expect(res.status).toBe(200);
  });
});

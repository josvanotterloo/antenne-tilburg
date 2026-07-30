// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: {
    supplier: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/suppliers/route";
import { PATCH, DELETE } from "@/app/api/admin/suppliers/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const supplier = db.supplier as unknown as {
  findMany: Mock; create: Mock; update: Mock; delete: Mock; findUnique: Mock;
};
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, url: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/suppliers", () => {
  it("searches by name (?q=), capped and alphabetical", async () => {
    supplier.findMany.mockResolvedValue([{ id: "s1", name: "Kalahari Oyster Cult" }]);
    const res = await GET(req("GET", "http://t/api/admin/suppliers?q=kala"));
    expect(res.status).toBe(200);
    expect(supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "kala", mode: "insensitive" } },
        orderBy: { name: "asc" },
        take: 20,
      }),
    );
  });
});

describe("POST /api/admin/suppliers", () => {
  it("creates a supplier (201)", async () => {
    supplier.create.mockResolvedValue({ id: "s1", name: "X", contact: null });
    const res = await POST(req("POST", "http://t/api/admin/suppliers", { name: "X" }));
    expect(res.status).toBe(201);
  });

  it("400s a blank name", async () => {
    const res = await POST(req("POST", "http://t/api/admin/suppliers", { name: "" }));
    expect(res.status).toBe(400);
    expect(supplier.create).not.toHaveBeenCalled();
  });

  it("409s a duplicate name", async () => {
    supplier.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(req("POST", "http://t/api/admin/suppliers", { name: "X" }));
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/admin/suppliers/[id]", () => {
  it("updates name/contact", async () => {
    supplier.update.mockResolvedValue({ id: "s1", name: "Y", contact: "ask Jules" });
    const res = await PATCH(req("PATCH", "http://t/x", { name: "Y", contact: "ask Jules" }), ctx("s1"));
    expect(res.status).toBe(200);
  });

  it("409s a duplicate name on update", async () => {
    supplier.update.mockRejectedValue({ code: "P2002" });
    const res = await PATCH(req("PATCH", "http://t/x", { name: "Y" }), ctx("s1"));
    expect(res.status).toBe(409);
  });

  it("404s an unknown supplier on update", async () => {
    supplier.update.mockRejectedValue({ code: "P2025" });
    const res = await PATCH(req("PATCH", "http://t/x", { name: "Y" }), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/suppliers/[id]", () => {
  it("404s when the supplier doesn't exist", async () => {
    supplier.findUnique.mockResolvedValue(null);
    const res = await DELETE(req("DELETE", "http://t/x"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("409s (with count) when supply orders exist", async () => {
    supplier.findUnique.mockResolvedValue({ id: "s1", _count: { supplyOrders: 2 } });
    const res = await DELETE(req("DELETE", "http://t/x"), ctx("s1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ count: 2 });
    expect(supplier.delete).not.toHaveBeenCalled();
  });

  it("deletes when no supply orders exist", async () => {
    supplier.findUnique.mockResolvedValue({ id: "s1", _count: { supplyOrders: 0 } });
    const res = await DELETE(req("DELETE", "http://t/x"), ctx("s1"));
    expect(res.status).toBe(200);
    expect(supplier.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});

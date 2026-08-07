// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { label: { findMany: vi.fn(), create: vi.fn() } } }));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/labels/route";
import { requireAdmin } from "@/lib/api-auth";

const label = db.label as unknown as { findMany: Mock; create: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);
const getReq = (q = "") => new Request(`http://t/x?q=${q}`);
const postReq = (body: unknown) =>
  new Request("http://t/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/labels", () => {
  it("shapes each row with supplierId/supplierName", async () => {
    label.findMany.mockResolvedValue([
      { id: "l1", name: "Warp", _count: { products: 3 }, supplier: { id: "s1", name: "Beta" } },
      { id: "l2", name: "Ghostly", _count: { products: 0 }, supplier: null },
    ]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      { id: "l1", name: "Warp", productCount: 3, supplierId: "s1", supplierName: "Beta" },
      { id: "l2", name: "Ghostly", productCount: 0, supplierId: null, supplierName: null },
    ]);
  });
});

describe("POST /api/admin/labels", () => {
  it("creates a label with a supplier (201)", async () => {
    label.create.mockResolvedValue({
      id: "l1",
      name: "Warp",
      supplier: { id: "s1", name: "Beta" },
    });
    const res = await POST(postReq({ name: "Warp", supplierId: "s1" }));
    expect(res.status).toBe(201);
    expect(label.create).toHaveBeenCalledWith({
      data: { name: "Warp", supplierId: "s1" },
      include: { supplier: true },
    });
    expect(await res.json()).toEqual({
      id: "l1",
      name: "Warp",
      supplierId: "s1",
      supplierName: "Beta",
    });
  });

  it("400s a blank name without writing", async () => {
    const res = await POST(postReq({ name: "" }));
    expect(res.status).toBe(400);
    expect(label.create).not.toHaveBeenCalled();
  });

  it("409s a duplicate name", async () => {
    label.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(postReq({ name: "Warp" }));
    expect(res.status).toBe(409);
  });
});

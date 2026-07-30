// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { stockTransaction: { findMany: vi.fn() } } }));

import { GET } from "@/app/api/admin/products/[id]/transactions/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test");

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/products/[id]/transactions", () => {
  it("returns the running-balance history, newest first", async () => {
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([
      { id: "t1", type: "IN", quantity: 5, note: null, createdAt: new Date("2026-01-01") },
      { id: "t2", type: "OUT", quantity: -1, note: null, createdAt: new Date("2026-01-02") },
    ] as never);
    const res = await GET(req(), ctx("p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((r: { id: string }) => r.id)).toEqual(["t2", "t1"]);
    expect(body[0].runningBalance).toBe(4);
    expect(db.stockTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: "p1" }, orderBy: { createdAt: "asc" } }),
    );
  });

  it("returns the 401 from requireAdmin without querying", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await GET(req(), ctx("p1"));
    expect(res.status).toBe(401);
    expect(db.stockTransaction.findMany).not.toHaveBeenCalled();
  });
});

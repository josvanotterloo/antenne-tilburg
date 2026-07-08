// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: vi.fn() } }));

import { POST } from "@/app/api/admin/products/[id]/sell-one/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const queryRaw = db.$queryRaw as unknown as Mock;
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("POST /api/admin/products/[id]/sell-one", () => {
  it("atomically decrements and returns the updated product", async () => {
    queryRaw.mockResolvedValue([{ id: "p1", quantity: 2, inStock: true }]);
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ quantity: 2, inStock: true });
    // Single atomic statement — no separate read then write.
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown product (no row updated)", async () => {
    queryRaw.mockResolvedValue([]);
    const res = await POST(req(), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns the 401 from requireAdmin without querying", async () => {
    mockRequireAdmin.mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    const res = await POST(req(), ctx("p1"));
    expect(res.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

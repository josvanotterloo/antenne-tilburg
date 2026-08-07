// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/order-overview", () => ({ getOpenOrderLines: vi.fn() }));

import { GET } from "@/app/api/admin/orders/route";
import { getOpenOrderLines } from "@/lib/order-overview";
import { requireAdmin } from "@/lib/api-auth";

const mockGetOpenOrderLines = vi.mocked(getOpenOrderLines);
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (qs = "") => new Request(`http://t/api/admin/orders${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockGetOpenOrderLines.mockResolvedValue({ groupBy: "supplier", groups: [] });
});

describe("GET /api/admin/orders", () => {
  it("defaults to groupBy=supplier", async () => {
    await GET(req());
    expect(mockGetOpenOrderLines).toHaveBeenCalledWith("supplier");
  });

  it("passes through a valid groupBy value", async () => {
    await GET(req("?groupBy=date"));
    expect(mockGetOpenOrderLines).toHaveBeenCalledWith("date");
  });

  it("falls back to supplier for an invalid groupBy value", async () => {
    await GET(req("?groupBy=nonsense"));
    expect(mockGetOpenOrderLines).toHaveBeenCalledWith("supplier");
  });

  it("returns the result as JSON", async () => {
    mockGetOpenOrderLines.mockResolvedValue({ groupBy: "flat", lines: [] });
    const res = await GET(req("?groupBy=flat"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ groupBy: "flat", lines: [] });
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/transactions-overview", () => ({ getMonthTransactions: vi.fn() }));

import { GET } from "@/app/api/admin/transactions/route";
import { getMonthTransactions } from "@/lib/transactions-overview";
import { requireAdmin } from "@/lib/api-auth";

const mockGet = vi.mocked(getMonthTransactions);
const mockRequireAdmin = vi.mocked(requireAdmin);
const req = (qs = "") => new Request(`http://t/api/admin/transactions${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockGet.mockResolvedValue([]);
});

describe("GET /api/admin/transactions", () => {
  it("passes the month query param through", async () => {
    await GET(req("?month=2026-06"));
    expect(mockGet).toHaveBeenCalledWith("2026-06");
  });

  it("defaults to the current shop month when month is omitted", async () => {
    await GET(req());
    expect(mockGet).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/));
  });
});

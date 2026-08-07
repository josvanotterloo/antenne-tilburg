// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({ db: { stockTransaction: { findMany: vi.fn() } } }));

import { db } from "@/lib/db";
import { getMonthTransactions } from "@/lib/transactions-overview";

const findMany = (db.stockTransaction as unknown as { findMany: Mock }).findMany;

beforeEach(() => vi.clearAllMocks());

describe("getMonthTransactions", () => {
  it("returns an empty array for a malformed month without querying", async () => {
    const result = await getMonthTransactions("not-a-month");
    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries the month's date range, newest first, with product relations", async () => {
    findMany.mockResolvedValue([]);
    await getMonthTransactions("2026-08");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: expect.any(Date), lt: expect.any(Date) } },
        orderBy: { createdAt: "desc" },
        include: expect.objectContaining({
          product: expect.objectContaining({
            include: expect.objectContaining({ label: true }),
          }),
        }),
      }),
    );
  });
});

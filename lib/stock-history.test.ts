import { describe, it, expect } from "vitest";

import { computeRunningBalance } from "@/lib/stock-history";

const row = (over: Partial<Parameters<typeof computeRunningBalance>[0][number]>) => ({
  id: "t1",
  type: "IN" as const,
  quantity: 1,
  note: null,
  createdAt: new Date("2026-01-01"),
  ...over,
});

describe("computeRunningBalance", () => {
  it("accumulates oldest-first, returns newest-first, first entry equals the final balance", () => {
    const result = computeRunningBalance([
      row({ id: "t1", quantity: 5, createdAt: new Date("2026-01-01") }),
      row({ id: "t2", quantity: -2, createdAt: new Date("2026-01-02") }),
      row({ id: "t3", quantity: 3, createdAt: new Date("2026-01-03") }),
    ]);
    expect(result.map((r) => r.id)).toEqual(["t3", "t2", "t1"]);
    expect(result.map((r) => r.runningBalance)).toEqual([6, 3, 5]);
  });

  it("returns an empty array for a product with no transactions", () => {
    expect(computeRunningBalance([])).toEqual([]);
  });
});

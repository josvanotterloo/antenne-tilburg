import { describe, it, expect, vi } from "vitest";

import { backfillNormalizedNames } from "@/lib/backfill-normalized-names";

describe("backfillNormalizedNames", () => {
  it("normalizes and sets every row returned by the finder, and returns the count", async () => {
    const setNormalizedName = vi.fn().mockResolvedValue({ id: "1" });
    const result = await backfillNormalizedNames({
      findRowsNeedingBackfill: () =>
        Promise.resolve([
          { id: "1", name: "JEFF MILLS" },
          { id: "2", name: "Simon & Garfunkel" },
        ]),
      setNormalizedName,
    });

    expect(result).toEqual({ rowsBackfilled: 2 });
    expect(setNormalizedName).toHaveBeenCalledWith({
      id: "1",
      normalizedName: "jeff mills",
    });
    expect(setNormalizedName).toHaveBeenCalledWith({
      id: "2",
      normalizedName: "simon and garfunkel",
    });
  });

  it("does nothing when there are no rows to backfill", async () => {
    const setNormalizedName = vi.fn();
    const result = await backfillNormalizedNames({
      findRowsNeedingBackfill: () => Promise.resolve([]),
      setNormalizedName,
    });
    expect(result).toEqual({ rowsBackfilled: 0 });
    expect(setNormalizedName).not.toHaveBeenCalled();
  });
});

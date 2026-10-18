import { describe, it, expect, vi } from "vitest";

import {
  normalizeReferenceName,
  findDuplicateByNormalizedName,
  type NormalizedNameDelegate,
} from "@/lib/reference-dedupe";

describe("normalizeReferenceName", () => {
  it("lowercases", () => {
    expect(normalizeReferenceName("Jeff Mills")).toBe("jeff mills");
  });

  it("treats case variants as the same name", () => {
    expect(normalizeReferenceName("JEFF MILLS")).toBe(
      normalizeReferenceName("Jeff Mills"),
    );
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeReferenceName("  Jeff Mills  ")).toBe("jeff mills");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeReferenceName("Jeff   Mills")).toBe("jeff mills");
  });

  it("unifies '&' and 'and'", () => {
    expect(normalizeReferenceName("Simon & Garfunkel")).toBe(
      normalizeReferenceName("Simon and Garfunkel"),
    );
  });
});

describe("findDuplicateByNormalizedName", () => {
  function makeDelegate() {
    const findFirst = vi.fn();
    return { findFirst, delegate: { findFirst } as NormalizedNameDelegate };
  }

  it("returns true when a match exists (create case, no excludeId)", async () => {
    const { findFirst, delegate } = makeDelegate();
    findFirst.mockResolvedValue({ id: "1" });

    const found = await findDuplicateByNormalizedName(delegate, "JEFF MILLS");

    expect(found).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { normalizedName: "jeff mills" },
      select: { id: true },
    });
  });

  it("returns false when no match exists", async () => {
    const { findFirst, delegate } = makeDelegate();
    findFirst.mockResolvedValue(null);

    const found = await findDuplicateByNormalizedName(delegate, "New Artist");

    expect(found).toBe(false);
  });

  it("excludes the row's own id on rename", async () => {
    const { findFirst, delegate } = makeDelegate();
    findFirst.mockResolvedValue(null);

    await findDuplicateByNormalizedName(delegate, "Jeff Mills", "self-id");

    expect(findFirst).toHaveBeenCalledWith({
      where: { normalizedName: "jeff mills", id: { not: "self-id" } },
      select: { id: true },
    });
  });
});

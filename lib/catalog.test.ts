// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: { $queryRaw: vi.fn() } }));

import {
  JUST_IN_DAYS,
  PAGE_SIZE,
  buildCatalogWhere,
  buildCatalogOrderBy,
  parsePage,
  pageToSkip,
  pageCount,
  searchProductIds,
} from "@/lib/catalog";
import { db } from "@/lib/db";

describe("constants", () => {
  it("exposes JUST_IN_DAYS=30 and PAGE_SIZE=50", () => {
    expect(JUST_IN_DAYS).toBe(30);
    expect(PAGE_SIZE).toBe(50);
  });
});

describe("buildCatalogWhere", () => {
  it("is empty with no filters", () => {
    expect(buildCatalogWhere({})).toEqual({});
  });

  it("maps scalar filters", () => {
    expect(
      buildCatalogWhere({
        genreId: "g1",
        labelId: "l1",
        productTypeId: "t1",
        condition: "NEW",
      }),
    ).toEqual({
      genreId: "g1",
      labelId: "l1",
      productTypeId: "t1",
      condition: "NEW",
    });
  });

  it("adds inStock only when onlyInStock is set", () => {
    expect(buildCatalogWhere({ onlyInStock: true })).toEqual({ inStock: true });
    expect(buildCatalogWhere({ onlyInStock: false })).toEqual({});
  });

  it("adds a createdAt lower bound for justIn using JUST_IN_DAYS", () => {
    const now = new Date("2026-07-03T00:00:00.000Z");
    const where = buildCatalogWhere({ justIn: true, now });
    const gte = (where.createdAt as { gte: Date }).gte;
    expect(gte.getTime()).toBe(now.getTime() - JUST_IN_DAYS * 86_400_000);
  });

  it("restricts to FTS-matched ids when provided", () => {
    expect(buildCatalogWhere({ ids: ["a", "b"] })).toEqual({
      id: { in: ["a", "b"] },
    });
  });

  it("combines everything", () => {
    const now = new Date("2026-07-03T00:00:00.000Z");
    const where = buildCatalogWhere({
      genreId: "g1",
      condition: "SECONDHAND",
      onlyInStock: true,
      justIn: true,
      ids: ["x"],
      now,
    });
    expect(where.genreId).toBe("g1");
    expect(where.condition).toBe("SECONDHAND");
    expect(where.inStock).toBe(true);
    expect(where.id).toEqual({ in: ["x"] });
    expect(where.createdAt).toBeDefined();
  });
});

describe("buildCatalogOrderBy", () => {
  it("defaults to newest first", () => {
    expect(buildCatalogOrderBy()).toEqual({ createdAt: "desc" });
    expect(buildCatalogOrderBy("date")).toEqual({ createdAt: "desc" });
    expect(buildCatalogOrderBy("date", "asc")).toEqual({ createdAt: "asc" });
  });

  it("sorts by artist (asc default) with title as tiebreaker", () => {
    expect(buildCatalogOrderBy("artist")).toEqual([
      { artist: "asc" },
      { title: "asc" },
    ]);
    expect(buildCatalogOrderBy("artist", "desc")).toEqual([
      { artist: "desc" },
      { title: "asc" },
    ]);
  });

  it("sorts by label name", () => {
    expect(buildCatalogOrderBy("label")).toEqual({ label: { name: "asc" } });
  });
});

describe("pagination math", () => {
  it("parsePage clamps to >= 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage(5)).toBe(5);
  });

  it("pageToSkip = (page-1)*PAGE_SIZE", () => {
    expect(pageToSkip(1)).toBe(0);
    expect(pageToSkip("3")).toBe(100);
    expect(pageToSkip(undefined)).toBe(0);
  });

  it("pageCount rounds up, min 1", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(50)).toBe(1);
    expect(pageCount(51)).toBe(2);
    expect(pageCount(120)).toBe(3);
  });
});

describe("searchProductIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] for a blank query without touching the db", async () => {
    expect(await searchProductIds("  ")).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns matched ids for a real query", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const ids = await searchProductIds("surgeon");
    expect(ids).toEqual(["p1", "p2"]);
    // the term is passed through the tagged-template values
    const arg = vi.mocked(db.$queryRaw).mock.calls[0][0] as { values: unknown[] };
    expect(arg.values).toContain("surgeon");
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    product: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import {
  JUST_IN_DAYS,
  PAGE_SIZE,
  buildCatalogWhere,
  buildCatalogOrderBy,
  parsePage,
  pageToSkip,
  pageCount,
  searchProductIds,
  getCatalogPage,
  getLatestProducts,
  isJustIn,
  catalogPageNumbers,
  weekRange,
  shopDayRange,
  shopDateISO,
  isRestock,
  getThisWeekProducts,
  getLastWeekProducts,
  getBackInStockProducts,
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

  it("filters by artist name, case-insensitively", () => {
    expect(buildCatalogWhere({ artist: "Vril" })).toEqual({
      artist: { equals: "Vril", mode: "insensitive" },
    });
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

describe("catalogPageNumbers", () => {
  it("returns a bounded window that never lists every page", () => {
    expect(catalogPageNumbers(1, 1)).toEqual([1]);
    expect(catalogPageNumbers(1, 5)).toEqual([1, 2, 5]);
    expect(catalogPageNumbers(3, 10)).toEqual([1, 2, 3, 4, 10]);
    expect(catalogPageNumbers(10, 10)).toEqual([1, 9, 10]);
    // even with 200 pages the window stays small
    expect(catalogPageNumbers(100, 200)).toEqual([1, 99, 100, 101, 200]);
  });
});

describe("isJustIn", () => {
  const now = new Date("2026-07-03T00:00:00.000Z").getTime();
  it("is true within the JUST_IN_DAYS window", () => {
    expect(isJustIn(new Date("2026-07-01T00:00:00.000Z"), now)).toBe(true);
  });
  it("is false outside the window", () => {
    expect(isJustIn(new Date("2026-05-01T00:00:00.000Z"), now)).toBe(false);
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

  it("combines full-text with trigram partial + similarity matching", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([] as never);
    await searchProductIds("bio");
    const arg = vi.mocked(db.$queryRaw).mock.calls[0][0] as unknown as {
      text: string;
      values: unknown[];
    };
    expect(arg.text).toContain("websearch_to_tsquery"); // full-word FTS
    expect(arg.text.toUpperCase()).toContain("ILIKE"); // partial / substring
    expect(arg.text).toMatch(/artist % \$/); // trigram similarity operator
    expect(arg.values).toContain("bio"); // FTS + similarity term
    expect(arg.values).toContain("%bio%"); // ILIKE partial pattern
  });

  it("escapes LIKE wildcards in the partial pattern", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([] as never);
    await searchProductIds("50%_off");
    const arg = vi.mocked(db.$queryRaw).mock.calls[0][0] as unknown as {
      values: unknown[];
    };
    expect(arg.values).toContain("%50\\%\\_off%");
  });
});

describe("getCatalogPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs findMany + count with pagination and returns a paged result", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([{ id: "p1" }] as never);
    vi.mocked(db.product.count).mockResolvedValue(120 as never);

    const res = await getCatalogPage({ page: "2", onlyInStock: true });

    expect(res.total).toBe(120);
    expect(res.page).toBe(2);
    expect(res.pageCount).toBe(3);
    expect(res.products).toHaveLength(1);
    const arg = vi.mocked(db.product.findMany).mock.calls[0][0] as {
      skip: number;
      take: number;
    };
    expect(arg.skip).toBe(50);
    expect(arg.take).toBe(PAGE_SIZE);
  });

  it("passes q to FTS and injects the matched ids into the where", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ id: "p9" }] as never);
    vi.mocked(db.product.findMany).mockResolvedValue([] as never);
    vi.mocked(db.product.count).mockResolvedValue(0 as never);

    await getCatalogPage({ q: "surgeon", onlyInStock: true });

    const ftsArg = vi.mocked(db.$queryRaw).mock.calls[0][0] as {
      values: unknown[];
    };
    expect(ftsArg.values).toContain("surgeon");
    const where = (
      vi.mocked(db.product.findMany).mock.calls[0][0] as {
        where: { id?: { in: string[] } };
      }
    ).where;
    expect(where.id).toEqual({ in: ["p9"] });
  });

  it("does not run FTS when there is no q", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([] as never);
    vi.mocked(db.product.count).mockResolvedValue(0 as never);

    await getCatalogPage({ onlyInStock: true });

    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("getLatestProducts", () => {
  it("queries in-stock products newest-first, limited to the given count", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([] as never);
    await getLatestProducts(100);
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inStock: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  });

  it("defaults to 100 when no limit is given", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([] as never);
    await getLatestProducts();
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

// The shop week runs Monday 00:00 – Sunday 24:00 in Europe/Amsterdam. All
// boundary instants below are expressed in UTC (CEST = UTC+2 in July,
// CET = UTC+1 in January).
describe("weekRange (shop-timezone Mon–Sun weeks)", () => {
  // Wednesday 15 July 2026, 12:00 in Amsterdam.
  const WED = new Date("2026-07-15T10:00:00Z");

  it("brackets the current week from Monday 00:00 shop time", () => {
    const { start, end } = weekRange(0, WED);
    // Monday 13 July 00:00 CEST = Sunday 12 July 22:00 UTC.
    expect(start.toISOString()).toBe("2026-07-12T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-19T22:00:00.000Z");
  });

  it("offsets whole weeks for last week", () => {
    const { start, end } = weekRange(-1, WED);
    expect(start.toISOString()).toBe("2026-07-05T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-12T22:00:00.000Z");
  });

  it("Monday midnight itself belongs to the new week", () => {
    // Exactly Monday 13 July 00:00 CEST.
    const mondayMidnight = new Date("2026-07-12T22:00:00Z");
    const { start } = weekRange(0, mondayMidnight);
    expect(start.toISOString()).toBe("2026-07-12T22:00:00.000Z");
    // One millisecond earlier is still Sunday of the previous week.
    const justBefore = new Date("2026-07-12T21:59:59.999Z");
    expect(weekRange(0, justBefore).start.toISOString()).toBe(
      "2026-07-05T22:00:00.000Z",
    );
  });

  it("handles Sunday correctly (last day of the week, not the first)", () => {
    // Sunday 19 July 2026, 23:30 in Amsterdam.
    const sundayNight = new Date("2026-07-19T21:30:00Z");
    const { start } = weekRange(0, sundayNight);
    expect(start.toISOString()).toBe("2026-07-12T22:00:00.000Z");
  });

  it("uses the winter offset outside DST", () => {
    // Wednesday 14 January 2026, 12:00 CET (UTC+1).
    const winter = new Date("2026-01-14T11:00:00Z");
    const { start, end } = weekRange(0, winter);
    // Monday 12 Jan 00:00 CET = Sunday 11 Jan 23:00 UTC.
    expect(start.toISOString()).toBe("2026-01-11T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-18T23:00:00.000Z");
  });
});

describe("getThisWeekProducts / getLastWeekProducts", () => {
  const WED = new Date("2026-07-15T10:00:00Z");

  beforeEach(() => vi.mocked(db.product.findMany).mockResolvedValue([] as never));

  it("this week: in-stock, created within the current shop week, newest first", async () => {
    await getThisWeekProducts({ now: WED });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inStock: true,
          createdAt: {
            gte: new Date("2026-07-12T22:00:00Z"),
            lt: new Date("2026-07-19T22:00:00Z"),
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("last week: the previous Mon–Sun window", async () => {
    await getLastWeekProducts({ now: WED });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inStock: true,
          createdAt: {
            gte: new Date("2026-07-05T22:00:00Z"),
            lt: new Date("2026-07-12T22:00:00Z"),
          },
        },
      }),
    );
  });
});

describe("section queries — genre/condition filters", () => {
  const WED = new Date("2026-07-15T10:00:00Z");

  beforeEach(() => vi.mocked(db.product.findMany).mockResolvedValue([] as never));

  it("this week filters by genre within the week window", async () => {
    await getThisWeekProducts({ genreId: "g1", now: WED });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inStock: true,
          genreId: "g1",
          createdAt: {
            gte: new Date("2026-07-12T22:00:00Z"),
            lt: new Date("2026-07-19T22:00:00Z"),
          },
        }),
      }),
    );
  });

  it("last week filters by condition within the previous window", async () => {
    await getLastWeekProducts({ condition: "SECONDHAND", now: WED });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inStock: true,
          condition: "SECONDHAND",
          createdAt: {
            gte: new Date("2026-07-05T22:00:00Z"),
            lt: new Date("2026-07-12T22:00:00Z"),
          },
        }),
      }),
    );
  });

  it("back in stock filters by genre and condition alongside its own clauses", async () => {
    await getBackInStockProducts({ genreId: "g1", condition: "NEW", now: WED });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inStock: true,
          genreId: "g1",
          condition: "NEW",
          quantity: { gt: 0 },
          updatedAt: { gte: new Date("2026-06-15T10:00:00Z") },
        }),
      }),
    );
  });
});

describe("getBackInStockProducts", () => {
  const NOW = new Date("2026-07-15T10:00:00Z");
  // Real rows always carry quantity (the where clause enforces > 0); the
  // fixture models that so the shared isRestock predicate sees a full row.
  const row = (over: Record<string, unknown>) => ({
    id: "p",
    quantity: 2,
    createdAt: new Date("2026-06-01T10:00:00Z"),
    updatedAt: new Date("2026-07-10T10:00:00Z"),
    ...over,
  });

  it("queries in-stock, quantity > 0, updated in the last 30 days, most recent first", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([] as never);
    await getBackInStockProducts({ now: NOW });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inStock: true,
          quantity: { gt: 0 },
          updatedAt: { gte: new Date("2026-06-15T10:00:00Z") },
        },
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  it("excludes new products (updatedAt ~ createdAt) but keeps real restocks", async () => {
    const restocked = row({ id: "restocked" });
    // A freshly created product: updatedAt only milliseconds after createdAt.
    const fresh = row({
      id: "fresh",
      createdAt: new Date("2026-07-10T10:00:00.000Z"),
      updatedAt: new Date("2026-07-10T10:00:00.150Z"),
    });
    vi.mocked(db.product.findMany).mockResolvedValue([restocked, fresh] as never);

    const result = await getBackInStockProducts({ now: NOW });
    expect(result.map((p) => p.id)).toEqual(["restocked"]);
  });
});

describe("shopDayRange (inclusive shop-local date range)", () => {
  it("brackets from-midnight to the day after to-midnight, shop time", () => {
    const range = shopDayRange("2026-07-13", "2026-07-15");
    expect(range).not.toBeNull();
    // 13 Jul 00:00 CEST = 12 Jul 22:00Z; end is exclusive: 16 Jul 00:00 CEST.
    expect(range!.start.toISOString()).toBe("2026-07-12T22:00:00.000Z");
    expect(range!.end.toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });

  it("supports a single-day range (from == to)", () => {
    const range = shopDayRange("2026-07-13", "2026-07-13");
    expect(range!.start.toISOString()).toBe("2026-07-12T22:00:00.000Z");
    expect(range!.end.toISOString()).toBe("2026-07-13T22:00:00.000Z");
  });

  it("uses the winter offset outside DST", () => {
    const range = shopDayRange("2026-01-12", "2026-01-12");
    expect(range!.start.toISOString()).toBe("2026-01-11T23:00:00.000Z");
  });

  it("rejects malformed dates and reversed ranges", () => {
    expect(shopDayRange("2026-7-3", "2026-07-15")).toBeNull();
    expect(shopDayRange("nope", "2026-07-15")).toBeNull();
    expect(shopDayRange("2026-07-15", "2026-07-13")).toBeNull();
  });
});

describe("shopDateISO", () => {
  it("formats an instant as its shop-local calendar date", () => {
    // 22:30Z on 12 July is already 13 July in Amsterdam (CEST).
    expect(shopDateISO(new Date("2026-07-12T22:30:00Z"))).toBe("2026-07-13");
    expect(shopDateISO(new Date("2026-01-11T23:30:00Z"))).toBe("2026-01-12");
  });
});

describe("isRestock", () => {
  const base = new Date("2026-07-01T10:00:00.000Z");

  it("true when updated well after creation with stock remaining", () => {
    expect(
      isRestock({
        createdAt: base,
        updatedAt: new Date("2026-07-10T10:00:00Z"),
        quantity: 2,
      }),
    ).toBe(true);
  });

  it("false for a fresh product (create-time clock jitter)", () => {
    expect(
      isRestock({
        createdAt: base,
        updatedAt: new Date(base.getTime() + 150),
        quantity: 2,
      }),
    ).toBe(false);
  });

  it("false when out of stock regardless of timestamps", () => {
    expect(
      isRestock({
        createdAt: base,
        updatedAt: new Date("2026-07-10T10:00:00Z"),
        quantity: 0,
      }),
    ).toBe(false);
  });
});

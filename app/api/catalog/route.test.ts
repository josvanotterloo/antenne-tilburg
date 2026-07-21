// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { product: { findMany: vi.fn(), count: vi.fn() } },
}));

import { GET } from "@/app/api/catalog/route";
import { db } from "@/lib/db";

const PRODUCT = {
  id: "p1",
  artist: "Biosphere",
  title: "Substrata",
  catalogNumber: "DC001",
  price: "12.99",
  condition: "NEW",
  inStock: true,
  description: null,
  quantity: 3,
  createdAt: new Date("2026-07-01T10:00:00Z"),
  updatedAt: new Date("2026-07-01T10:00:00Z"),
  label: { id: "l1", name: "Dirty Carpets" },
  genre: { id: "g1", name: "Ambient" },
  productType: { id: "t1", name: "LP" },
};

const get = (url = "http://localhost/api/catalog") => GET(new Request(url));
const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.product.findMany).mockResolvedValue([PRODUCT] as never);
  vi.mocked(db.product.count).mockResolvedValue(1 as never);
});

describe("GET /api/catalog", () => {
  it("returns only in-stock products with the documented shape", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ inStock: true }) }),
    );
    expect(db.product.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ inStock: true }) }),
    );
    expect(body.total).toBe(1);
    expect(body.products[0]).toMatchObject({
      id: "p1",
      artist: "Biosphere",
      title: "Substrata",
      label: "Dirty Carpets",
      catalogNumber: "DC001",
      genre: "Ambient",
      productType: "LP",
      condition: "NEW",
      price: "12.99",
      currency: "EUR",
      inStock: true,
      isRestock: false,
      url: `${base}/stock/p1`,
    });
    expect(typeof body.generatedAt).toBe("string");
  });

  it("does not require authentication", async () => {
    const res = await get();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("filters by genre", async () => {
    await get("http://localhost/api/catalog?genre=Techno");
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          genre: { is: { name: { equals: "Techno", mode: "insensitive" } } },
        }),
      }),
    );
  });

  it("filters by condition", async () => {
    await get("http://localhost/api/catalog?condition=SECONDHAND");
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ condition: "SECONDHAND" }),
      }),
    );
  });

  it("ignores an invalid condition value instead of erroring", async () => {
    const res = await get("http://localhost/api/catalog?condition=BOGUS");
    expect(res.status).toBe(200);
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ condition: expect.anything() }),
      }),
    );
  });

  it("defaults to a limit of 100 and caps at 500", async () => {
    await get();
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );

    await get("http://localhost/api/catalog?limit=1000");
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );

    await get("http://localhost/api/catalog?limit=10");
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("marks a restock correctly using the shared epsilon logic", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([
      {
        ...PRODUCT,
        createdAt: new Date("2026-06-01T10:00:00Z"),
        updatedAt: new Date("2026-07-10T10:00:00Z"),
      },
    ] as never);
    const body = await (await get()).json();
    expect(body.products[0].isRestock).toBe(true);
  });

  it("reports the full matching count even when limit truncates the returned products", async () => {
    vi.mocked(db.product.count).mockResolvedValue(42 as never);
    const body = await (await get("http://localhost/api/catalog?limit=1")).json();
    expect(body.total).toBe(42);
    expect(body.products).toHaveLength(1);
  });

  it("sets a 5-minute public cache header", async () => {
    const res = await get();
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("returns a clean 500 JSON error instead of crashing when the DB fails", async () => {
    vi.mocked(db.product.findMany).mockRejectedValue(new Error("db down"));
    const res = await get();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getBackInStockProducts: vi.fn() };
});

import { GET } from "@/app/(public)/stock/back-in-stock/feed.xml/route";
import { getBackInStockProducts } from "@/lib/catalog";

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  price: "24.99",
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-07-10T09:30:00Z"),
  label: { name: "Zulema Records" },
  genre: { name: "Techno" },
  productType: { name: "LP" },
};

describe("/stock/back-in-stock/feed.xml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an RSS document of restocked products, dated by updatedAt", async () => {
    vi.mocked(getBackInStockProducts).mockResolvedValue([PRODUCT] as never);

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/xml/);
    expect(body).toContain("<rss");
    expect(body).toContain("Back In Stock");
    expect(body).toContain("Vril — Torus");
    expect(body).toContain("/stock/p1");
    // Items are dated by when they came back, not when they first arrived.
    expect(body).toContain(new Date("2026-07-10T09:30:00Z").toUTCString());
    expect(body).not.toContain(new Date("2026-06-01T00:00:00Z").toUTCString());
  });

  it("escapes XML-special characters", async () => {
    vi.mocked(getBackInStockProducts).mockResolvedValue([
      { ...PRODUCT, title: "Rock & Roll <mix>" },
    ] as never);

    const body = await (await GET()).text();
    expect(body).toContain("Rock &amp; Roll &lt;mix&gt;");
  });
});

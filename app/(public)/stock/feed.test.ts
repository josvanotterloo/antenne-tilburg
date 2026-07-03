// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { product: { findMany: vi.fn() } },
}));

import { GET } from "@/app/(public)/stock/feed.xml/route";
import { db } from "@/lib/db";

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  price: "24.99",
  createdAt: new Date("2026-07-01T00:00:00Z"),
  label: { name: "Zulema Records" },
  genre: { name: "Techno" },
  productType: { name: "LP" },
};

describe("/stock/feed.xml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an RSS document of recent in-stock arrivals", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([PRODUCT] as never);

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/xml/);
    expect(body).toContain("<rss");
    expect(body).toContain("Vril — Torus");
    expect(body).toContain("/stock/p1");
    expect(body).toContain("Zulema Records");
    expect(body).toContain("24.99");

    // last 50, newest first, in-stock only
    const args = vi.mocked(db.product.findMany).mock.calls[0][0] as {
      take: number;
      where: { inStock: boolean };
      orderBy: { createdAt: string };
    };
    expect(args.take).toBe(50);
    expect(args.where).toEqual({ inStock: true });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  it("escapes XML-special characters", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([
      { ...PRODUCT, title: "Rock & Roll <mix>" },
    ] as never);

    const body = await (await GET()).text();
    expect(body).toContain("Rock &amp; Roll &lt;mix&gt;");
  });
});

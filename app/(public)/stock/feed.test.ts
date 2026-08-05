// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getLatestProducts: vi.fn() };
});

import { GET } from "@/app/(public)/stock/feed.xml/route";
import { getLatestProducts } from "@/lib/catalog";

const PRODUCT = {
  id: "p1",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  createdAt: new Date("2026-07-01T00:00:00Z"),
  label: { name: "Zulema Records" },
  genre: { name: "Techno" },
  productType: { name: "LP" },
};

describe("/stock/feed.xml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an RSS document of the last 100 in-stock arrivals, no price", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([PRODUCT] as never);

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/xml/);
    expect(body).toContain("<rss");
    expect(body).toContain("Vril — Torus");
    expect(body).toContain("/stock/p1");
    expect(body).toContain("Zulema Records");
    expect(body).not.toContain("€");

    // getLatestProducts() with no args uses its default limit of 100 —
    // mirrors the /stock page exactly.
    expect(getLatestProducts).toHaveBeenCalledWith();
  });

  it("escapes XML-special characters", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      { ...PRODUCT, title: "Rock & Roll <mix>" },
    ] as never);

    const body = await (await GET()).text();
    expect(body).toContain("Rock &amp; Roll &lt;mix&gt;");
  });
});

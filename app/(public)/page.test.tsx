import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getLatestProducts: vi.fn() };
});
vi.mock("@/lib/blog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blog")>();
  return { ...actual, getPublishedPosts: vi.fn() };
});

import HomePage from "@/app/(public)/page";
import { getLatestProducts } from "@/lib/catalog";
import { getPublishedPosts } from "@/lib/blog";

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  inStock: true,
  coverImage: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  labelId: "l1",
  genreId: "g1",
  productTypeId: "t1",
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

const POST = {
  id: "b1",
  title: "Fresh Techno Drop",
  slug: "fresh-techno-drop",
  body: "New arrivals landed today.",
  coverImage: null,
  status: "PUBLISHED",
  publishedAt: new Date("2026-07-01T10:00:00.000Z"),
  seoTitle: null,
  seoDescription: null,
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  updatedAt: new Date("2026-07-01T10:00:00.000Z"),
};

const hrefs = () =>
  screen.getAllByRole("link").map((a) => a.getAttribute("href"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLatestProducts).mockResolvedValue([PRODUCT] as never);
  vi.mocked(getPublishedPosts).mockResolvedValue([POST] as never);
});

describe("home page", () => {
  it("shows the Just In arrivals linking to each product", async () => {
    render(await HomePage());
    const link = screen.getByRole("link", { name: /Torus/ });
    expect(link).toHaveAttribute("href", "/stock/p1");
  });

  it("requests the 100 latest arrivals", async () => {
    await HomePage();
    expect(getLatestProducts).toHaveBeenCalledWith(100);
  });

  it("teases the latest blog posts linking to each post", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("link", { name: /Fresh Techno Drop/ }),
    ).toHaveAttribute("href", "/blog/fresh-techno-drop");
  });

  it("links to stock, blog and visit", async () => {
    render(await HomePage());
    const all = hrefs();
    expect(all).toContain("/stock");
    expect(all).toContain("/blog");
    expect(all).toContain("/visit");
  });

  it("handles an empty catalogue without crashing", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([] as never);
    vi.mocked(getPublishedPosts).mockResolvedValue([] as never);
    render(await HomePage());
    expect(hrefs()).toContain("/stock");
  });
});

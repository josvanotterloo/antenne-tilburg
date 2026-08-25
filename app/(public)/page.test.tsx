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
vi.mock("@/lib/db", () => ({
  db: { openingHours: { findMany: vi.fn() } },
}));

import HomePage from "@/app/(public)/page";
import { getLatestProducts } from "@/lib/catalog";
import { getPublishedPosts } from "@/lib/blog";
import { db } from "@/lib/db";

const PRODUCT = {
  id: "p1",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  inStock: true,
  quantity: 1,
  coverImage: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  labelId: "l1",
  productTypeId: "t1",
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
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
  vi.mocked(db.openingHours.findMany).mockResolvedValue([
    { dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: false },
  ] as never);
});

describe("home page", () => {
  it("shows the Just In arrivals linking to each product", async () => {
    render(await HomePage());
    const link = screen.getByRole("link", { name: /Torus/ });
    expect(link).toHaveAttribute("href", "/stock/p1");
  });

  it("does not render a price in the Just In section", async () => {
    render(await HomePage());
    expect(screen.queryByText(/€/)).toBeNull();
  });

  it("uses New Arrivals copy for the stock CTAs", async () => {
    render(await HomePage());
    expect(screen.getByRole("link", { name: /browse new arrivals/i })).toHaveAttribute(
      "href",
      "/stock",
    );
    expect(screen.getByRole("link", { name: "New arrivals →" })).toHaveAttribute(
      "href",
      "/stock",
    );
  });

  it("shows a 'View all new arrivals' link below the table, pointing to /stock", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("link", { name: "View all new arrivals →" }),
    ).toHaveAttribute("href", "/stock");
  });

  it("requests the 5 latest in-stock arrivals", async () => {
    await HomePage();
    expect(getLatestProducts).toHaveBeenCalledWith(5, true);
  });

  it("renders the same Type/Artist/Title/Label table columns as /stock", async () => {
    render(await HomePage());
    for (const name of ["Type", "Artist", "Title", "Label"]) {
      expect(
        screen.getByRole("columnheader", { name: new RegExp(`^${name}$`, "i") }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("LP")).toBeInTheDocument();
    expect(screen.getByText("Zulema Records")).toBeInTheDocument();
  });

  it("does not show a JUST IN/New badge on any row", async () => {
    render(await HomePage());
    expect(screen.queryByText("New", { selector: "span" })).toBeNull();
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

  it("emits MusicStore structured data with live opening hours", async () => {
    const { container } = render(await HomePage());
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(ld).not.toBeNull();
    const data = JSON.parse(ld?.textContent ?? "{}");
    expect(data["@type"]).toBe("MusicStore");
    expect(data.name).toBe("Antenne Recordshop");
    expect(data.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "12:00",
        closes: "18:00",
      },
    ]);
  });

  it("degrades to no opening hours in structured data if the DB call fails", async () => {
    vi.mocked(db.openingHours.findMany).mockRejectedValue(new Error("db down"));
    const { container } = render(await HomePage());
    const ld = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(ld?.textContent ?? "{}");
    expect(data.openingHoursSpecification).toEqual([]);
  });
});

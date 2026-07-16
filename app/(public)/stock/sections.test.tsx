import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/db", () => ({
  db: { genre: { findMany: vi.fn() } },
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    getThisWeekProducts: vi.fn(),
    getLastWeekProducts: vi.fn(),
    getBackInStockProducts: vi.fn(),
  };
});

import ThisWeekPage from "@/app/(public)/stock/this-week/page";
import LastWeekPage from "@/app/(public)/stock/last-week/page";
import BackInStockPage from "@/app/(public)/stock/back-in-stock/page";
import {
  getThisWeekProducts,
  getLastWeekProducts,
  getBackInStockProducts,
} from "@/lib/catalog";
import { db } from "@/lib/db";

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  price: "24.99",
  condition: "NEW",
  createdAt: new Date(),
  updatedAt: new Date(),
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

const PAGES = [
  {
    name: "this-week",
    basePath: "/stock/this-week",
    Page: ThisWeekPage,
    query: vi.mocked(getThisWeekProducts),
    heading: "This Week",
  },
  {
    name: "last-week",
    basePath: "/stock/last-week",
    Page: LastWeekPage,
    query: vi.mocked(getLastWeekProducts),
    heading: "Last Week",
  },
  {
    name: "back-in-stock",
    basePath: "/stock/back-in-stock",
    Page: BackInStockPage,
    query: vi.mocked(getBackInStockProducts),
    heading: "Back In Stock",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.genre.findMany).mockResolvedValue([
    { id: "g1", name: "Techno" },
  ] as never);
  for (const p of PAGES) p.query.mockResolvedValue([PRODUCT] as never);
});

describe.each(PAGES)("/stock/$name", ({ Page, query, heading, basePath }) => {
  it("renders the heading and each product's key fields", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: heading }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
    // Genre/condition also appear as sidebar filter links now, so assert
    // them inside the product row's meta line specifically.
    const meta = screen.getByText("Zulema Records").closest("span");
    expect(meta).toHaveTextContent(/Techno/);
    expect(meta).toHaveTextContent(/NEW/);
    expect(screen.getByText(/€24\.99/)).toBeInTheDocument();
  });

  it("links back to the full stock listing", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("link", { name: /all stock/i }),
    ).toHaveAttribute("href", "/stock");
  });

  it("shows the persistent stock nav with this section marked current", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /this week/i })).toHaveAttribute(
      "href",
      "/stock/this-week",
    );
    expect(screen.getByRole("link", { name: /last week/i })).toHaveAttribute(
      "href",
      "/stock/last-week",
    );
    expect(
      screen.getByRole("link", { name: /back in stock/i }),
    ).toHaveAttribute("href", "/stock/back-in-stock");

    expect(screen.getByRole("link", { name: heading })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a search input that submits to /stock (full search support)", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("name", "q");
    expect(input.closest("form")).toHaveAttribute("action", "/stock");
  });

  it("passes genre and condition filters through to the query", async () => {
    await Page({
      searchParams: Promise.resolve({ genre: "Techno", condition: "NEW" }),
    });
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ genreId: "g1", condition: "NEW" }),
    );
  });

  it("renders the genre sidebar filter scoped to this section", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: /^Genre$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Techno" })).toHaveAttribute(
      "href",
      expect.stringContaining("genre=Techno"),
    );
  });

  it("shows active filters as removable chips with a clear-all", async () => {
    render(
      await Page({ searchParams: Promise.resolve({ genre: "Techno" }) }),
    );
    // The chip and the active sidebar link both remove the filter; the
    // unambiguous signal that chips rendered is the Clear all link.
    expect(screen.getByRole("link", { name: /clear all/i })).toHaveAttribute(
      "href",
      basePath,
    );
    // Chip + sidebar entry: the genre name appears as more than one link.
    expect(screen.getAllByRole("link", { name: /techno/i }).length)
      .toBeGreaterThanOrEqual(2);
  });

  it("shows the empty state when there is nothing", async () => {
    query.mockResolvedValue([] as never);
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/nothing yet/i)).toBeInTheDocument();
  });
});

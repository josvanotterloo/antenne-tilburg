import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
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
    Page: ThisWeekPage,
    query: vi.mocked(getThisWeekProducts),
    heading: "This Week",
  },
  {
    name: "last-week",
    Page: LastWeekPage,
    query: vi.mocked(getLastWeekProducts),
    heading: "Last Week",
  },
  {
    name: "back-in-stock",
    Page: BackInStockPage,
    query: vi.mocked(getBackInStockProducts),
    heading: "Back In Stock",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const p of PAGES) p.query.mockResolvedValue([PRODUCT] as never);
});

describe.each(PAGES)("/stock/$name", ({ Page, query, heading }) => {
  it("renders the heading and each product's key fields", async () => {
    render(await Page());

    expect(
      screen.getByRole("heading", { name: heading }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
    expect(screen.getByText("Zulema Records")).toBeInTheDocument();
    expect(screen.getByText(/Techno/)).toBeInTheDocument();
    expect(screen.getByText(/NEW/)).toBeInTheDocument();
    expect(screen.getByText(/€24\.99/)).toBeInTheDocument();
  });

  it("links back to the full stock listing", async () => {
    render(await Page());
    expect(
      screen.getByRole("link", { name: /all stock/i }),
    ).toHaveAttribute("href", "/stock");
  });

  it("shows the empty state when there is nothing", async () => {
    query.mockResolvedValue([] as never);
    render(await Page());
    expect(screen.getByText(/nothing yet/i)).toBeInTheDocument();
  });
});

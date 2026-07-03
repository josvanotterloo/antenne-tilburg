import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/db", () => ({
  db: {
    genre: { findMany: vi.fn() },
    label: { findMany: vi.fn() },
    productType: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getCatalogPage: vi.fn() };
});

import StockPage from "@/app/(public)/stock/page";
import { db } from "@/lib/db";
import { getCatalogPage } from "@/lib/catalog";

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.genre.findMany).mockResolvedValue([] as never);
  vi.mocked(db.label.findMany).mockResolvedValue([] as never);
  vi.mocked(db.productType.findMany).mockResolvedValue([] as never);
  vi.mocked(getCatalogPage).mockResolvedValue({
    products: [PRODUCT] as never,
    total: 1,
    page: 1,
    pageCount: 1,
  });
});

describe("/stock page", () => {
  it("renders products from the DB result", async () => {
    const ui = await StockPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText(/Torus/)).toBeInTheDocument();
    expect(screen.getByText(/Zulema Records/)).toBeInTheDocument();
  });

  it("passes the ?q= search term through to the catalog query", async () => {
    const ui = await StockPage({
      searchParams: Promise.resolve({ q: "surgeon" }),
    });
    render(ui);
    expect(getCatalogPage).toHaveBeenCalledWith(
      expect.objectContaining({ q: "surgeon", onlyInStock: true }),
    );
  });

  it("restricts the public listing to in-stock products", async () => {
    await StockPage({ searchParams: Promise.resolve({}) });
    expect(getCatalogPage).toHaveBeenCalledWith(
      expect.objectContaining({ onlyInStock: true }),
    );
  });
});

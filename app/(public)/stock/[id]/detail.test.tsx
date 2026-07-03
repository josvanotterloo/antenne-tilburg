import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/db", () => ({
  db: { product: { findUnique: vi.fn() } },
}));

import ProductDetailPage from "@/app/(public)/stock/[id]/page";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  inStock: true,
  coverImage: null,
  description: "Hypnotic dub-techno LP.",
  createdAt: new Date(),
  updatedAt: new Date(),
  labelId: "l1",
  genreId: "g1",
  productTypeId: "t1",
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

const call = (id: string) =>
  ProductDetailPage({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("/stock/[id] detail", () => {
  it("renders a valid in-stock product with its relations", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    render(await call("p1"));
    expect(
      screen.getByRole("heading", { name: /Vril — Torus/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("ZR-001")).toBeInTheDocument();
    expect(screen.getAllByText(/Zulema Records/).length).toBeGreaterThan(0);
    expect(screen.getByText("Hypnotic dub-techno LP.")).toBeInTheDocument();
  });

  it("404s when the product does not exist", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(null as never);
    await expect(call("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("404s when the product is out of stock", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      ...PRODUCT,
      inStock: false,
    } as never);
    await expect(call("p1")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

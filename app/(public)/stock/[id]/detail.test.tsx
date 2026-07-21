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
  quantity: 1,
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

  it("links artist and label to filtered stock views", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    render(await call("p1"));
    expect(screen.getAllByRole("link", { name: "Vril" })[0]).toHaveAttribute(
      "href",
      "/stock?artist=Vril",
    );
    expect(
      screen.getAllByRole("link", { name: "Zulema Records" })[0],
    ).toHaveAttribute("href", "/stock?label=Zulema%20Records");
  });

  it("shows the RESTOCK badge when the product is a restock", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      ...PRODUCT,
      createdAt: new Date("2026-06-01T10:00:00Z"),
      updatedAt: new Date("2026-07-10T10:00:00Z"),
      quantity: 2,
    } as never);
    render(await call("p1"));
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });

  it("does not show the RESTOCK badge for a freshly created product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    render(await call("p1"));
    expect(screen.queryByText(/restock/i)).toBeNull();
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

  it("emits Product + MusicRecording structured data with the correct price and availability", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    const { container } = render(await call("p1"));
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(ld).not.toBeNull();
    const data = JSON.parse(ld?.textContent ?? "{}");
    expect(data["@type"]).toEqual(["Product", "MusicRecording"]);
    expect(data.name).toBe("Vril — Torus");
    expect(data.offers.price).toBe("24.99");
    expect(data.offers.availability).toBe("https://schema.org/InStock");
  });
});

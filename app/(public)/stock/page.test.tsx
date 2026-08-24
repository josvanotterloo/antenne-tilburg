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
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getLatestProducts: vi.fn() };
});

import StockPage from "@/app/(public)/stock/page";
import { getLatestProducts } from "@/lib/catalog";

const product = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  price: "24.99",
  condition: "NEW",
  inStock: true,
  quantity: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
  productType: { id: "t1", name: "LP" },
  ...over,
});

const noParams = Promise.resolve({});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLatestProducts).mockResolvedValue([product()] as never);
});

describe("/stock page", () => {
  it("renders the New Arrivals heading", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(
      screen.getByRole("heading", { name: /new arrivals/i }),
    ).toBeInTheDocument();
  });

  it("requests the last 100 arrivals, all stock statuses, by default", async () => {
    await StockPage({ searchParams: noParams });
    expect(getLatestProducts).toHaveBeenCalledWith(100, false);
  });

  it("requests only in-stock arrivals when ?instock=true", async () => {
    await StockPage({ searchParams: Promise.resolve({ instock: "true" }) });
    expect(getLatestProducts).toHaveBeenCalledWith(100, true);
  });

  it("renders products from getLatestProducts", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText(/Torus/)).toBeInTheDocument();
    expect(screen.getByText(/Zulema Records/)).toBeInTheDocument();
  });

  it("shows the RESTOCK badge when a product is a restock", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      product({
        createdAt: new Date("2026-06-01T10:00:00Z"),
        updatedAt: new Date("2026-07-10T10:00:00Z"),
        quantity: 2,
      }),
    ] as never);
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });

  it("shows the JUST IN badge for a recently created product", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      product({ createdAt: new Date() }),
    ] as never);
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByText(/just in/i)).toBeInTheDocument();
  });

  it("renders no filter sidebar, search box, sort controls, or pagination", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("heading", { name: /^genre$/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^condition$/i })).toBeNull();
    expect(screen.queryByText(/sort:/i)).toBeNull();
    expect(screen.queryByText(/grid view/i)).toBeNull();
    expect(screen.queryByText(/list view/i)).toBeNull();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
    expect(screen.queryByRole("navigation", { name: /stock sections/i })).toBeNull();
  });

  it("does not render a price or artist/label links", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Vril" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Zulema Records" })).toBeNull();
  });

  it("renders each product's title as a link to its detail page", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByRole("link", { name: /Torus/ })).toHaveAttribute(
      "href",
      "/stock/p1",
    );
  });

  it("shows an empty-state message and no list when there are no arrivals", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([] as never);
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows an 'In stock only' toggle, off by default, linking to turn it on", async () => {
    render(await StockPage({ searchParams: noParams }));
    const toggle = screen.getByRole("link", { name: /in stock only/i });
    expect(toggle).toHaveAttribute("href", "/stock?instock=true");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the toggle as on and linking back to all stock when ?instock=true", async () => {
    render(
      await StockPage({ searchParams: Promise.resolve({ instock: "true" }) }),
    );
    const toggle = screen.getByRole("link", { name: /in stock only/i });
    expect(toggle).toHaveAttribute("href", "/stock");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});

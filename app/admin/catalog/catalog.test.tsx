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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getCatalogPage: vi.fn() };
});
vi.mock("@/lib/open-order-lookup", () => ({ getOpenOrderProductIds: vi.fn() }));

import AdminCatalogPage from "@/app/admin/catalog/page";
import { getCatalogPage } from "@/lib/catalog";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const PRODUCT = {
  id: "p1",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  quantity: 4,
  inStock: true,
  createdAt: new Date(Date.now() - 3 * DAY),
  updatedAt: new Date(Date.now() - 2 * HOUR),
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
  productType: { id: "t1", name: "LP" },
  supplierId: "s1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCatalogPage).mockResolvedValue({
    products: [PRODUCT] as never,
    total: 120,
    page: 2,
    pageCount: 3,
  });
  vi.mocked(getOpenOrderProductIds).mockResolvedValue(new Set());
});

describe("/admin/catalog", () => {
  it("renders products and the total count", async () => {
    const ui = await AdminCatalogPage({
      searchParams: Promise.resolve({ page: "2" }),
    });
    render(ui);
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
    // Quantity is shown, with a single-click "Sell one" action per row.
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sell one/i }),
    ).toBeInTheDocument();
  });

  it("shows each row's key info at a glance, with relative dates and an edit link", async () => {
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
    expect(screen.getByText("Zulema Records")).toBeInTheDocument();
    expect(screen.getByText("Techno")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // quantity
    expect(screen.getByText(/€24\.99/)).toBeInTheDocument();

    // Relative dates: created shows age, updated is how you spot restocks.
    expect(screen.getByText(/added 3 days ago/i)).toBeInTheDocument();
    expect(screen.getByText(/updated 2 hours ago/i)).toBeInTheDocument();
    // Full timestamp on hover.
    expect(screen.getByText(/added 3 days ago/i)).toHaveAttribute("title");

    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/admin/catalog/p1/edit",
    );
  });

  it("does not render the product's condition", async () => {
    vi.mocked(getCatalogPage).mockResolvedValue({
      products: [{ ...PRODUCT, condition: "SECONDHAND" }] as never,
      total: 1,
      page: 1,
      pageCount: 1,
    });
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.queryByText("NEW")).not.toBeInTheDocument();
    expect(screen.queryByText("SECONDHAND")).not.toBeInTheDocument();
  });

  it("passes ?q= through and shows all products (not in-stock only)", async () => {
    await AdminCatalogPage({ searchParams: Promise.resolve({ q: "vril" }) });
    expect(getCatalogPage).toHaveBeenCalledWith(
      expect.objectContaining({ q: "vril", onlyInStock: false }),
    );
  });

  it("passes onlyInStock: true when ?instock=true", async () => {
    await AdminCatalogPage({
      searchParams: Promise.resolve({ instock: "true" }),
    });
    expect(getCatalogPage).toHaveBeenCalledWith(
      expect.objectContaining({ onlyInStock: true }),
    );
  });

  it("shows an 'In stock only' toggle, off by default, linking to turn it on", async () => {
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    const toggle = screen.getByRole("link", { name: /in stock only/i });
    expect(toggle).toHaveAttribute("href", "/admin/catalog?instock=true");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("Clear link preserves the instock filter while clearing the search text", async () => {
    const ui = await AdminCatalogPage({
      searchParams: Promise.resolve({ q: "vril", instock: "true" }),
    });
    render(ui);
    expect(screen.getByRole("link", { name: /clear/i })).toHaveAttribute(
      "href",
      "/admin/catalog?instock=true",
    );
  });

  it("shows the toggle as on, preserving ?q=, when ?instock=true", async () => {
    const ui = await AdminCatalogPage({
      searchParams: Promise.resolve({ q: "vril", instock: "true" }),
    });
    render(ui);
    const toggle = screen.getByRole("link", { name: /in stock only/i });
    expect(toggle).toHaveAttribute("href", "/admin/catalog?q=vril");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a print icon link with the correct href for a complete product", async () => {
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(
      screen.getByRole("link", { name: /print label/i }),
    ).toHaveAttribute("href", "/api/admin/label/p1");
  });

  it("hides the print icon for a product missing required fields", async () => {
    vi.mocked(getCatalogPage).mockResolvedValue({
      products: [{ ...PRODUCT, productArtists: [] }] as never,
      total: 1,
      page: 1,
      pageCount: 1,
    });
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.queryByRole("link", { name: /print label/i })).toBeNull();
  });

  it("shows a disabled Order button with a tooltip when the product has no supplier", async () => {
    vi.mocked(getCatalogPage).mockResolvedValue({
      products: [{ ...PRODUCT, supplierId: null }] as never,
      total: 1,
      page: 1,
      pageCount: 1,
    });
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    const button = screen.getByRole("button", { name: /order/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "No supplier linked");
  });

  it("shows a disabled 'Ordered' button when the product is already in an open order", async () => {
    vi.mocked(getCatalogPage).mockResolvedValue({
      products: [{ ...PRODUCT, supplierId: "s1" }] as never,
      total: 1,
      page: 1,
      pageCount: 1,
    });
    vi.mocked(getOpenOrderProductIds).mockResolvedValue(new Set(["p1"]));
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("button", { name: /ordered/i })).toBeDisabled();
  });
});

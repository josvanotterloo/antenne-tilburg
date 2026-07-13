import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getCatalogPage: vi.fn() };
});

import AdminCatalogPage from "@/app/admin/catalog/page";
import { getCatalogPage } from "@/lib/catalog";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  quantity: 4,
  inStock: true,
  createdAt: new Date(Date.now() - 3 * DAY),
  updatedAt: new Date(Date.now() - 2 * HOUR),
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCatalogPage).mockResolvedValue({
    products: [PRODUCT] as never,
    total: 120,
    page: 2,
    pageCount: 3,
  });
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
    expect(screen.getByText("NEW")).toBeInTheDocument();
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

  it("passes ?q= through and shows all products (not in-stock only)", async () => {
    await AdminCatalogPage({ searchParams: Promise.resolve({ q: "vril" }) });
    expect(getCatalogPage).toHaveBeenCalledWith(
      expect.objectContaining({ q: "vril", onlyInStock: false }),
    );
  });
});

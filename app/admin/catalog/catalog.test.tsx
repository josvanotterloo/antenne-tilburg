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

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  inStock: true,
  createdAt: new Date(),
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
  });

  it("passes ?q= through and shows all products (not in-stock only)", async () => {
    await AdminCatalogPage({ searchParams: Promise.resolve({ q: "vril" }) });
    expect(getCatalogPage).toHaveBeenCalledWith(
      expect.objectContaining({ q: "vril", onlyInStock: false }),
    );
  });
});

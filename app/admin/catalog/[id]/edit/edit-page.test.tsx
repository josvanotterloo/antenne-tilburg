import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: vi.fn() },
    stockTransaction: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import EditProductPage from "@/app/admin/catalog/[id]/edit/page";
import { db } from "@/lib/db";

const PRODUCT = {
  id: "p1",
  productArtists: [{ artist: { id: "a1", name: "Vril" } }],
  title: "Torus",
  catalogNumber: "ZR-001",
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
  productType: { id: "t1", name: "LP" },
  condition: "NEW",
  price: "24.99",
  description: null,
  coverImage: null,
  quantity: 4,
};

beforeEach(() => vi.clearAllMocks());

describe("/admin/catalog/[id]/edit", () => {
  it("shows the transaction history with a running balance", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([
      { id: "t1", type: "ADJUSTMENT", quantity: 5, note: "Opening balance", createdAt: new Date("2026-01-01") },
      { id: "t2", type: "OUT", quantity: -1, note: null, createdAt: new Date("2026-01-02") },
    ] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.getByText("Opening balance")).toBeInTheDocument();
    expect(screen.getByText("Uit")).toBeInTheDocument();
    // Verify row order: history is newest-first, so first data row (index 1)
    // has current balance (4), last data row has opening balance (5).
    const rows = screen.getAllByRole("row");
    const firstDataRow = rows[1]; // index 0 is header
    const lastDataRow = rows[rows.length - 1];
    expect(firstDataRow.textContent).toContain("4"); // Current balance
    expect(lastDataRow.textContent).toContain("5"); // Opening balance
  });

  it("orders transactions by createdAt then id, so same-timestamp rows sort deterministically", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    await EditProductPage({ params: Promise.resolve({ id: "p1" }) });

    expect(db.stockTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: "p1" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("shows a placeholder when there's no history yet", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.getByText(/nog geen voorraadtransacties/i)).toBeInTheDocument();
  });

  it("shows a Print label link with the correct href for a complete product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(
      screen.getByRole("link", { name: /label afdrukken/i }),
    ).toHaveAttribute("href", "/api/admin/label/p1");
  });

  it("shows a missing-fields note instead of the print link when required fields are absent", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      ...PRODUCT,
      productArtists: [],
    } as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.queryByRole("link", { name: /label afdrukken/i })).toBeNull();
    const note = screen.getByText(/label afdrukken niet mogelijk/i);
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/artiest/i);
  });

  it("renders in English when the admin's locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.getByRole("heading", { name: "Edit product" })).toBeInTheDocument();
  });
});

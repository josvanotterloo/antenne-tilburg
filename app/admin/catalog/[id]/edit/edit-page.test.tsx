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

import EditProductPage from "@/app/admin/catalog/[id]/edit/page";
import { db } from "@/lib/db";

const PRODUCT = {
  id: "p1",
  productArtists: [{ artist: { id: "a1", name: "Vril" } }],
  title: "Torus",
  catalogNumber: "ZR-001",
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
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
    expect(screen.getByText("OUT")).toBeInTheDocument();
    // Verify row order: history is newest-first, so first data row (index 1)
    // has current balance (4), last data row has opening balance (5).
    const rows = screen.getAllByRole("row");
    const firstDataRow = rows[1]; // index 0 is header
    const lastDataRow = rows[rows.length - 1];
    expect(firstDataRow.textContent).toContain("4"); // Current balance
    expect(lastDataRow.textContent).toContain("5"); // Opening balance
  });

  it("shows a placeholder when there's no history yet", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.getByText(/no stock transactions yet/i)).toBeInTheDocument();
  });
});

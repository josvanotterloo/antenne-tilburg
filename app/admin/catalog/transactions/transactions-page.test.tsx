import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/transactions-overview", () => ({ getMonthTransactions: vi.fn() }));
vi.mock("@/lib/open-order-lookup", () => ({ getOpenOrderProductIds: vi.fn() }));

import TransactionsPage from "@/app/admin/catalog/transactions/page";
import { getMonthTransactions } from "@/lib/transactions-overview";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";
import { shopMonthISO } from "@/lib/catalog";

const OUT_TX = {
  id: "t1",
  type: "OUT" as const,
  quantity: -1,
  createdAt: new Date("2026-08-03T14:30:00Z"),
  product: {
    id: "p1",
    title: "Torus",
    catalogNumber: "ZR-001",
    supplierId: "s1",
    label: { name: "Zulema" },
    productArtists: [{ position: 0, artist: { name: "Vril" } }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOpenOrderProductIds).mockResolvedValue(new Set());
});

describe("/admin/catalog/transactions", () => {
  it("defaults to the current month and renders prev/next links", async () => {
    vi.mocked(getMonthTransactions).mockResolvedValue([]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("link", { name: /prev/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/admin/catalog/transactions?month="),
    );
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/admin/catalog/transactions?month="),
    );
  });

  it("passes ?month= through and renders that month's transactions", async () => {
    vi.mocked(getMonthTransactions).mockResolvedValue([OUT_TX]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-08" }) });
    render(ui);
    expect(getMonthTransactions).toHaveBeenCalledWith("2026-08");
    expect(screen.getByText("Torus")).toBeInTheDocument();
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText("OUT")).toBeInTheDocument();
  });

  it("shows an Order button on an OUT row and none on an IN row", async () => {
    const inTx = { ...OUT_TX, id: "t2", type: "IN" as const, quantity: 5 };
    vi.mocked(getMonthTransactions).mockResolvedValue([OUT_TX, inTx]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-08" }) });
    render(ui);
    expect(screen.getAllByRole("button", { name: /order/i })).toHaveLength(1);
  });

  it("shows an empty state for a month with no transactions", async () => {
    vi.mocked(getMonthTransactions).mockResolvedValue([]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-08" }) });
    render(ui);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });

  it("falls back to the current month for a syntactically-valid but out-of-range month (2026-13)", async () => {
    vi.mocked(getMonthTransactions).mockResolvedValue([]);
    const ui = await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-13" }) });
    render(ui);
    expect(getMonthTransactions).toHaveBeenCalledWith(shopMonthISO(new Date()));
  });
});

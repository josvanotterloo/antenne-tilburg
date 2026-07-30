import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/db", () => ({ db: { supplyOrder: { findMany: vi.fn() } } }));

import OrdersPage from "@/app/admin/catalog/orders/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/admin/catalog/orders", () => {
  it("lists orders with supplier, status and item count", async () => {
    vi.mocked(db.supplyOrder.findMany).mockResolvedValue([
      {
        id: "o1",
        supplier: { name: "Kalahari Oyster Cult" },
        reference: "PO-1",
        status: "PARTIAL",
        orderedAt: new Date("2026-07-29"),
        receivedAt: null,
        lines: [{}, {}],
      },
    ] as never);
    render(await OrdersPage());
    expect(screen.getByText("Kalahari Oyster Cult")).toBeInTheDocument();
    expect(screen.getByText("PARTIAL")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows a placeholder with no orders", async () => {
    vi.mocked(db.supplyOrder.findMany).mockResolvedValue([] as never);
    render(await OrdersPage());
    expect(screen.getByText(/no supply orders yet/i)).toBeInTheDocument();
  });
});

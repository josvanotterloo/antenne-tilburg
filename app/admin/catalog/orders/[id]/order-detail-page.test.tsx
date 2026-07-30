import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: { supplyOrder: { findUnique: vi.fn() } } }));

import OrderDetailPage from "@/app/admin/catalog/orders/[id]/page";
import { db } from "@/lib/db";

const ORDER = {
  id: "o1",
  status: "PENDING",
  reference: "PO-1",
  supplier: { name: "Kalahari Oyster Cult" },
  lines: [{ id: "l1", quantityOrdered: 5, quantityReceived: 0, product: { title: "Torus" } }],
};

beforeEach(() => vi.clearAllMocks());

describe("/admin/catalog/orders/[id]", () => {
  it("shows Edit/Delete and the receive form for a PENDING order", async () => {
    vi.mocked(db.supplyOrder.findUnique).mockResolvedValue(ORDER as never);
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText(/receive stock/i)).toBeInTheDocument();
  });

  it("hides Edit/Delete for a non-PENDING order, still shows receive for PARTIAL", async () => {
    vi.mocked(db.supplyOrder.findUnique).mockResolvedValue({ ...ORDER, status: "PARTIAL" } as never);
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.getByText(/receive stock/i)).toBeInTheDocument();
  });

  it("hides the receive form entirely once RECEIVED", async () => {
    vi.mocked(db.supplyOrder.findUnique).mockResolvedValue({ ...ORDER, status: "RECEIVED" } as never);
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.queryByText(/receive stock/i)).toBeNull();
  });
});

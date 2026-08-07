import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/order-overview", () => ({ getOpenOrderLines: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import OrdersOverviewPage from "@/app/admin/catalog/orders/page";
import { getOpenOrderLines } from "@/lib/order-overview";

const LINE = {
  id: "l1",
  quantityOrdered: 5,
  quantityReceived: 0,
  createdAt: new Date("2026-08-03T10:00:00Z"),
  supplyOrder: {
    id: "o1",
    status: "PENDING" as const,
    sentAt: null,
    supplier: { id: "s1", name: "Beta Distro" },
  },
  product: {
    id: "p1",
    title: "Torus",
    catalogNumber: "ZR-001",
    label: { name: "Zulema" },
    productType: { name: "LP" },
    productArtists: [{ position: 0, artist: { name: "Vril" } }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/admin/catalog/orders", () => {
  it("defaults to grouping by supplier and shows the supplier's line", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({
      groupBy: "supplier",
      groups: [
        {
          supplier: { id: "s1", name: "Beta Distro" },
          order: { id: "o1", status: "PENDING", sentAt: null },
          lines: [LINE],
        },
      ],
    });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(getOpenOrderLines).toHaveBeenCalledWith("supplier");
    expect(screen.getByText("Beta Distro")).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });

  it("passes ?group=date through to getOpenOrderLines and renders week sections", async () => {
    const weekStart = new Date("2026-08-03T00:00:00Z");
    vi.mocked(getOpenOrderLines).mockResolvedValue({
      groupBy: "date",
      groups: [{ weekStart, lines: [LINE] }],
    });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({ group: "date" }) });
    render(ui);
    expect(getOpenOrderLines).toHaveBeenCalledWith("date");
    expect(screen.getByText(/week of/i)).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });

  it("passes ?group=flat through and renders a flat list", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({ groupBy: "flat", lines: [LINE] });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({ group: "flat" }) });
    render(ui);
    expect(getOpenOrderLines).toHaveBeenCalledWith("flat");
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });

  it("shows an empty state when there are no open orders", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({ groupBy: "supplier", groups: [] });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByText(/no open orders/i)).toBeInTheDocument();
  });

  it("renders the auto-print checkbox", async () => {
    vi.mocked(getOpenOrderLines).mockResolvedValue({ groupBy: "supplier", groups: [] });
    const ui = await OrdersOverviewPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("checkbox", { name: /auto-print/i })).toBeInTheDocument();
  });
});

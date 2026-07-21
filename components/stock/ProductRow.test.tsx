import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ProductRow } from "@/components/stock/ProductRow";

const OLD = new Date("2026-06-01T10:00:00Z");
const RECENT = new Date("2026-07-10T10:00:00Z"); // well over 60s after OLD

const product = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  artist: "Vril",
  title: "Torus",
  price: "24.99",
  condition: "NEW",
  createdAt: OLD,
  updatedAt: OLD,
  quantity: 1,
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
  ...over,
});

describe("ProductRow — RESTOCK badge", () => {
  it("renders the RESTOCK badge when updatedAt is well after createdAt and stock remains", () => {
    render(
      <ProductRow product={product({ createdAt: OLD, updatedAt: RECENT, quantity: 2 }) as never} />,
    );
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });

  it("does not render the RESTOCK badge for a freshly created product", () => {
    render(<ProductRow product={product({ createdAt: OLD, updatedAt: OLD }) as never} />);
    expect(screen.queryByText(/restock/i)).toBeNull();
  });

  it("does not render the RESTOCK badge when out of stock", () => {
    render(
      <ProductRow
        product={product({ createdAt: OLD, updatedAt: RECENT, quantity: 0 }) as never}
      />,
    );
    expect(screen.queryByText(/restock/i)).toBeNull();
  });

  it("renders both JUST IN and RESTOCK together, gracefully, when both apply", () => {
    const now = new Date();
    render(
      <ProductRow
        product={
          product({
            createdAt: now, // within the Just In window
            updatedAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // >60s later, stock remains
            quantity: 3,
          }) as never
        }
      />,
    );
    expect(screen.getByText(/just in/i)).toBeInTheDocument();
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });
});

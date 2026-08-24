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
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  price: "24.99",
  condition: "NEW",
  createdAt: OLD,
  updatedAt: OLD,
  quantity: 1,
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
  productType: { id: "t1", name: "LP" },
  inStock: true,
  ...over,
});

// ProductRow renders a bare <tr> — a valid render target needs a real
// table/tbody ancestor, or jsdom silently drops/mis-renders the row.
function renderRow(p: ReturnType<typeof product>) {
  return render(
    <table>
      <tbody>
        <ProductRow product={p as never} />
      </tbody>
    </table>,
  );
}

describe("ProductRow — table columns", () => {
  it("renders type, artist, title, and label", () => {
    renderRow(product());
    expect(screen.getByText("LP")).toBeInTheDocument();
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
    expect(screen.getByText("Zulema Records")).toBeInTheDocument();
  });

  it("links only the title, to the product's detail page", () => {
    renderRow(product());
    expect(screen.getByRole("link", { name: /Torus/ })).toHaveAttribute(
      "href",
      "/stock/p1",
    );
    expect(screen.queryByRole("link", { name: "Vril" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Zulema Records" })).toBeNull();
    expect(screen.queryByRole("link", { name: "LP" })).toBeNull();
  });
});

describe("ProductRow — RESTOCK badge", () => {
  it("renders the RESTOCK badge when updatedAt is well after createdAt and stock remains", () => {
    renderRow(product({ createdAt: OLD, updatedAt: RECENT, quantity: 2 }));
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });

  it("does not render the RESTOCK badge for a freshly created product", () => {
    renderRow(product({ createdAt: OLD, updatedAt: OLD }));
    expect(screen.queryByText(/restock/i)).toBeNull();
  });

  it("does not render the RESTOCK badge when out of stock", () => {
    renderRow(product({ createdAt: OLD, updatedAt: RECENT, quantity: 0 }));
    expect(screen.queryByText(/restock/i)).toBeNull();
  });
});

describe("ProductRow — no JUST IN badge", () => {
  it("never renders a JUST IN badge, even for a freshly created product", () => {
    renderRow(product({ createdAt: new Date() }));
    expect(screen.queryByText(/just in/i)).toBeNull();
  });
});

describe("ProductRow — no price", () => {
  it("does not render a price", () => {
    renderRow(product());
    expect(screen.queryByText(/€/)).toBeNull();
  });
});

describe("ProductRow — Various Artists", () => {
  it('renders "VARIOUS ARTISTS" instead of the linked artist name', () => {
    renderRow(
      product({
        isVariousArtists: true,
        contents: "Surgeon, Regis",
        productArtists: [
          { position: 0, artistId: "va1", artist: { id: "va1", name: "Various Artists" } },
        ],
      }),
    );
    expect(screen.getByText("VARIOUS ARTISTS")).toBeInTheDocument();
    expect(screen.queryByText("Various Artists")).toBeNull();
  });

  it("does not render contents in the table", () => {
    renderRow(product({ isVariousArtists: true, contents: "Surgeon, Regis" }));
    expect(screen.queryByText(/Surgeon, Regis/)).toBeNull();
  });

  it("renders the linked artist name as usual for a non-VA product", () => {
    renderRow(product({ isVariousArtists: false }));
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.queryByText("VARIOUS ARTISTS")).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db", () => ({
  db: { productType: { findMany: vi.fn(), count: vi.fn() } },
}));

import ProductTypesPage from "./page";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.productType.findMany).mockResolvedValue([
    { id: "p1", name: "12\"", _count: { products: 5 } },
  ] as never);
  vi.mocked(db.productType.count).mockResolvedValue(1 as never);
});

describe("ProductTypesPage", () => {
  it("renders its own title and its own entity's items", async () => {
    render(await ProductTypesPage());
    expect(
      screen.getByRole("heading", { name: "Product Types", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('12"')).toBeInTheDocument();
  });

  it("renders only Product Types — no other section's heading", async () => {
    render(await ProductTypesPage());
    for (const name of ["Labels", "Artists", "Genres"]) {
      expect(
        screen.queryByRole("heading", { name, level: 1 }),
      ).not.toBeInTheDocument();
    }
  });

  it("only fetches the first page of product types, not the whole table", async () => {
    await ProductTypesPage();
    expect(db.productType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });
});

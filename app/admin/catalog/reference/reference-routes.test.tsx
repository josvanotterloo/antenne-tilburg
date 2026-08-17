import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db", () => ({
  db: {
    label: { findMany: vi.fn(), count: vi.fn() },
    genre: { findMany: vi.fn(), count: vi.fn() },
    productType: { findMany: vi.fn(), count: vi.fn() },
    artist: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import LabelsReferencePage from "./labels/page";
import ArtistsReferencePage from "./artists/page";
import GenresReferencePage from "./genres/page";
import ProductTypesReferencePage from "./product-types/page";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.label.findMany).mockResolvedValue([] as never);
  vi.mocked(db.label.count).mockResolvedValue(10484 as never);
  vi.mocked(db.genre.findMany).mockResolvedValue([] as never);
  vi.mocked(db.genre.count).mockResolvedValue(90 as never);
  vi.mocked(db.productType.findMany).mockResolvedValue([] as never);
  vi.mocked(db.productType.count).mockResolvedValue(132 as never);
  vi.mocked(db.artist.findMany).mockResolvedValue([] as never);
  vi.mocked(db.artist.count).mockResolvedValue(55295 as never);
});

describe("per-section reference routes", () => {
  const cases: [string, () => Promise<React.JSX.Element>, string][] = [
    ["/admin/catalog/reference/labels", LabelsReferencePage, "Labels"],
    ["/admin/catalog/reference/artists", ArtistsReferencePage, "Artists"],
    ["/admin/catalog/reference/genres", GenresReferencePage, "Genres"],
    [
      "/admin/catalog/reference/product-types",
      ProductTypesReferencePage,
      "Product Types",
    ],
  ];

  it.each(cases)("%s focuses the %s section", async (_route, Page, name) => {
    const ui = await Page();
    render(ui);
    expect(screen.getByRole("region", { name })).toHaveFocus();
  });
});

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

import { ReferenceDataView } from "./ReferenceDataView";
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

describe("ReferenceDataView focusSection", () => {
  it("focuses no section when focusSection is omitted", async () => {
    const ui = await ReferenceDataView({});
    render(ui);
    for (const name of ["Labels", "Genres", "Product Types", "Artists"]) {
      expect(screen.getByRole("region", { name })).not.toHaveFocus();
    }
  });

  it("focuses only the matching section for each focusSection value", async () => {
    const cases: [
      "labels" | "artists" | "genres" | "product-types",
      string,
    ][] = [
      ["labels", "Labels"],
      ["artists", "Artists"],
      ["genres", "Genres"],
      ["product-types", "Product Types"],
    ];
    for (const [focusSection, expectedName] of cases) {
      const ui = await ReferenceDataView({ focusSection });
      const { unmount } = render(ui);
      expect(screen.getByRole("region", { name: expectedName })).toHaveFocus();
      unmount();
    }
  });
});

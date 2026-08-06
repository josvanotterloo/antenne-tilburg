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

import ReferenceDataPage from "@/app/admin/catalog/reference/page";
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

describe("/admin/catalog/reference", () => {
  it("fetches only the first 20 rows per category, not the whole table", async () => {
    await ReferenceDataPage();
    expect(db.label.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(db.genre.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(db.productType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(db.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("fetches a grand total count per category alongside the first page", async () => {
    await ReferenceDataPage();
    expect(db.label.count).toHaveBeenCalled();
    expect(db.genre.count).toHaveBeenCalled();
    expect(db.productType.count).toHaveBeenCalled();
    expect(db.artist.count).toHaveBeenCalled();
  });

  it("passes the grand totals through to each section", async () => {
    const ui = await ReferenceDataPage();
    render(ui);
    // Thousands-separator character is locale-dependent (comma in en-US,
    // period in nl-NL etc.) — ReferenceSection.tsx intentionally doesn't pin
    // a locale on toLocaleString(), consistent with every other admin page
    // that formats numbers/dates. Match either separator rather than
    // asserting one.
    expect(screen.getByText(/10[.,]484\s*labels/i)).toBeInTheDocument();
    expect(screen.getByText(/90 genres/i)).toBeInTheDocument();
    expect(screen.getByText(/132 product types/i)).toBeInTheDocument();
    expect(screen.getByText(/55[.,]295\s*artists/i)).toBeInTheDocument();
  });
});

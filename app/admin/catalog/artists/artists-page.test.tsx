import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db", () => ({
  db: { artist: { findMany: vi.fn(), count: vi.fn() } },
}));

import ArtistsPage from "./page";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.artist.findMany).mockResolvedValue([
    { id: "a1", name: "Jeff Mills", _count: { productArtists: 2 } },
  ] as never);
  vi.mocked(db.artist.count).mockResolvedValue(1 as never);
});

describe("ArtistsPage", () => {
  it("renders its own title and its own entity's items", async () => {
    render(await ArtistsPage());
    expect(
      screen.getByRole("heading", { name: "Artists", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jeff Mills")).toBeInTheDocument();
  });

  it("renders only Artists — no other section's heading", async () => {
    render(await ArtistsPage());
    for (const name of ["Labels", "Genres", "Product Types"]) {
      expect(
        screen.queryByRole("heading", { name, level: 1 }),
      ).not.toBeInTheDocument();
    }
  });

  it("only fetches the first page of artists, not the whole table", async () => {
    await ArtistsPage();
    expect(db.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });
});

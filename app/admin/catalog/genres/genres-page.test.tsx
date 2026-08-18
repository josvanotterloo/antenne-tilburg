import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db", () => ({
  db: { genre: { findMany: vi.fn(), count: vi.fn() } },
}));

import GenresPage from "./page";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.genre.findMany).mockResolvedValue([
    { id: "g1", name: "Techno", _count: { products: 3 } },
  ] as never);
  vi.mocked(db.genre.count).mockResolvedValue(1 as never);
});

describe("GenresPage", () => {
  it("renders its own title and its own entity's items", async () => {
    render(await GenresPage());
    expect(
      screen.getByRole("heading", { name: "Genres", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Techno")).toBeInTheDocument();
  });

  it("renders only Genres — no other section's heading", async () => {
    render(await GenresPage());
    for (const name of ["Labels", "Artists", "Product Types"]) {
      expect(
        screen.queryByRole("heading", { name, level: 1 }),
      ).not.toBeInTheDocument();
    }
  });

  it("only fetches the first page of genres, not the whole table", async () => {
    await GenresPage();
    expect(db.genre.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });
});

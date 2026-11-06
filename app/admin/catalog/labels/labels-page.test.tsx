import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db", () => ({
  db: { label: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import LabelsPage from "./page";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.label.findMany).mockResolvedValue([
    {
      id: "l1",
      name: "Warp Records",
      _count: { products: 2 },
      supplier: { id: "s1", name: "Clearspot" },
    },
  ] as never);
  vi.mocked(db.label.count).mockResolvedValue(1 as never);
});

describe("LabelsPage", () => {
  it("renders its own title and its own entity's items", async () => {
    render(await LabelsPage());
    expect(
      screen.getByRole("heading", { name: "Labels", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Warp Records")).toBeInTheDocument();
  });

  it("renders only Labels — no other section's heading", async () => {
    render(await LabelsPage());
    for (const name of ["Artists", "Genres", "Product Types"]) {
      expect(
        screen.queryByRole("heading", { name, level: 1 }),
      ).not.toBeInTheDocument();
    }
  });

  it("only fetches the first page of labels, not the whole table", async () => {
    await LabelsPage();
    expect(db.label.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("renders in English when the admin's locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    render(await LabelsPage());
    expect(
      screen.getByRole("heading", { name: "Labels", level: 1 }),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/db", () => ({
  db: { openingHours: { findMany: vi.fn() } },
}));

import { SiteFooter } from "@/components/layout/SiteFooter";
import { db } from "@/lib/db";

const HOURS = [
  { id: "h0", dayOfWeek: 0, opensAt: "12:00", closesAt: "18:00", closed: true },
  { id: "h1", dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: false },
  { id: "h6", dayOfWeek: 6, opensAt: "12:00", closesAt: "18:00", closed: false },
];

beforeEach(() => vi.clearAllMocks());

describe("SiteFooter opening hours", () => {
  it("lists the days Monday-first, not Sunday-first", async () => {
    vi.mocked(db.openingHours.findMany).mockResolvedValue(HOURS as never);
    render(await SiteFooter());
    const days = screen
      .getAllByText(/^(Monday|Saturday|Sunday)$/)
      .map((el) => el.textContent);
    expect(days.indexOf("Monday")).toBeLessThan(days.indexOf("Sunday"));
  });

  it("formats open and closed days", async () => {
    vi.mocked(db.openingHours.findMany).mockResolvedValue(HOURS as never);
    render(await SiteFooter());
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getAllByText("12:00–18:00").length).toBeGreaterThan(0);
  });
});

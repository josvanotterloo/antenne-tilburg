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

import VisitPage from "@/app/(public)/visit/page";
import { db } from "@/lib/db";

const HOURS = [
  { id: "h1", dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: true },
  { id: "h2", dayOfWeek: 2, opensAt: "12:00", closesAt: "18:00", closed: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.openingHours.findMany).mockResolvedValue(HOURS as never);
});

describe("/visit page", () => {
  it("renders the shop address", async () => {
    render(await VisitPage());
    expect(screen.getByText(/Noordstraat 82/)).toBeInTheDocument();
    expect(screen.getByText(/5038 EK Tilburg/)).toBeInTheDocument();
  });

  it("renders opening hours live from the DB", async () => {
    render(await VisitPage());
    expect(screen.getByText("Tuesday")).toBeInTheDocument();
    expect(screen.getByText("12:00–18:00")).toBeInTheDocument();
    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders a tappable phone and email", async () => {
    render(await VisitPage());
    const phone = screen.getByRole("link", { name: /\d/ });
    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href")?.startsWith("tel:")),
    ).toBe(true);
    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href")?.startsWith("mailto:")),
    ).toBe(true);
    expect(phone).toBeInTheDocument();
  });

  it("links out to a map / directions", async () => {
    render(await VisitPage());
    const external = screen
      .getAllByRole("link")
      .some((a) => /openstreetmap|google\.com\/maps/.test(a.getAttribute("href") ?? ""));
    expect(external).toBe(true);
  });

  it("degrades gracefully when there are no hours", async () => {
    vi.mocked(db.openingHours.findMany).mockResolvedValue([] as never);
    render(await VisitPage());
    expect(screen.getByText(/please call ahead/i)).toBeInTheDocument();
  });
});
